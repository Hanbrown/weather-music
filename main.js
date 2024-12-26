import "dotenv/config";
import express from "express";
import fetch from "node-fetch";
import path from "node:path";
import cookieParser from "cookie-parser";

const app = express();

const SEC_TO_MSEC = 1000;
const ERR_MSG = "An Error occurred :( Perhaps try another address?";

app.use(express.json());
app.use(express.static("public"));
app.use(express.urlencoded({extended: true}));
app.use(cookieParser());

app.get("/", (_, res) => {
    res.sendFile(path.resolve(__dirname, "public", "index.html"));
});

app.post("/coordinates", (req, res) => {
    // console.log("Starting...");
    if ( Object.keys(req.body).length == 0 || !req.body.address.trim() ) {
        console.log(req.body);
        // console.log("Done.");
        res.status(400).json({status: 400, message: "Please enter an address"});
        return;
    }

    let address = req.body.address;

    // Prevent CRLF Attacks
    address = encodeURI(address.replaceAll(/(\r)?\n/g, ""));

    fetch(`https://geocoding.geo.census.gov/geocoder/locations/onelineaddress?address=${address}&benchmark=4&format=json`).then((e) => {
        return e.json();
    }).then(async (e) => {
        if (e.status != "404" && e.result.addressMatches.length > 0) {
            const address = e.result.addressMatches[0].coordinates;
            const coordX = address.x;
            const coordY = address.y;
            // console.log("Location found");

            const uri = await getForecastUri(coordX, coordY);
            // The API calls send back special error JSON objects -- if they're detected, stop the program
            if (uri.error) {
                throw new Error(uri.message);
            }
            const descriptors = await getWeatherDescriptors(uri);
            if (descriptors.error) {
                throw new Error(descriptors.message);
            }
            
            // Create a cookie with the auth token -- prevents unnecessary API calls
            let cookie = req.cookies.spotify_token;
            if (cookie === undefined) {
                const token = await getToken();
                if (token.error) {
                    throw new Error(token.message);
                }
                res.cookie("spotify_token", token, {maxAge: token.expires_in * SEC_TO_MSEC, httpOnly: true, sameSite: "strict"});
                cookie = token;
            }

            // Get the songs and sort by day
            let allSongs = await getAllSongs(descriptors, cookie);
            if (allSongs.error) {
                throw new Error(allSongs.message);
            }
            allSongs.sort((a, b) => {return a["index"]-b["index"];});
            // console.log("Done.");
            res.json({days: allSongs, message: "Success", status: 200});

            // DEBUG ONLY
            // res.status(200).json({status: 200, message: "All good"});
        }
        else {
            // console.log(JSON.stringify(e));
            throw new Error(e.errors);
        }
    }).catch((e) => {
        console.log(e);
        // console.log("Done.");
        res.status(400).json({status: 400, message: ERR_MSG});
    });
});

const getAllSongs = async (descriptors, token) => {
    const allPromises = [];
    descriptors.map((forecast, i) => {
        allPromises.push(searchForSongs(forecast, i, token));
    });
    return Promise.all(allPromises);
}

const getForecastUri = (x, y) => {
    return new Promise((resolve, reject) => {
        fetch(`https://api.weather.gov/points/${y},${x}`).then((e) => {
            return e.json();
        }).then((e) => {
            if (e.properties) {
                // console.log("Gridpoints found");
                resolve(e.properties.forecast);
            }
            else {
                // console.log(e);
                throw new Error(e.detail);
            }
        }).catch((e) => {
            reject({error: true, message: e.message});
        });
    });
}

const getWeatherDescriptors = (uri) => {
    return new Promise((resolve, reject) => {
        fetch(uri).then((e) => {
            return e.json();
        }).then((e) => {
            if (e.properties) {
                let data = e.properties.periods;
                let forecasts = data.map((datum) => {
                    return datum.shortForecast;
                });

                // console.log("Weather found");
                resolve(forecasts);
            }
            else {
                console.log(e);
                throw new Error("Weather API Error");
            }
        }).catch((e) => {
            reject({error: true, message: e.message});
        });
    });
}

const getToken = () => {
    const authOptions = {
        url: `https://accounts.spotify.com/api/token`,
        method: 'POST',
        headers: {
            'Authorization': 'Basic ' + btoa(process.env.client_id + ':' + process.env.client_secret),
            'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: 'grant_type=client_credentials'
    };

    return new Promise((resolve, reject) => {
        fetch(authOptions.url, authOptions).then((e) => {
            return e.json();
        }).then((e) => {
            if (e.error) {
                // console.log(e);
                throw new Error(e.error_description);
            }
            else {
                // console.log("Token found");
                resolve(e);
            }
        }).catch((e) => {
            reject({error: true, message: e.message});
        });
    });
}

const searchForSongs = (term, index, token) => {
    let the_headers = new Headers();
    the_headers.append("Authorization", `${token.token_type} ${token.access_token}`);

    return new Promise((resolve, reject) => {
        fetch(`https://api.spotify.com/v1/search?q=tag:${term}&type=track&market=US&limit=5`, {
            headers: the_headers
        }).then((e) => {
            return e.json();
        }).then((e) => {
            if (e.error) {
                console.log(e.error);
                throw new Error(e.error.message);
            }
            else {
                const ALBUM_COVER_300x300 = 1;

                const data = e.tracks.items;
                let the_songs = data.map((song) => {
                    return {
                        name: song.name,
                        uri: song.uri,
                        image: song.album.images[ALBUM_COVER_300x300]
                    };
                });

                resolve({
                    songs: the_songs,
                    index: index,
                    forecast: term
                });
                return;
            }
        }).catch((e) => {
            reject({error: true, message: e.message});
        });
    });
}

app.listen(4000, () => {console.log("Server running on port 4000")});