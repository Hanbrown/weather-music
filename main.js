import "dotenv/config";
import express from "express";
import fetch from "node-fetch";
import path from "node:path";

const app = express();
app.use(express.json());
app.use(express.urlencoded({extended: true}));

app.get("/", (_, res) => {
    res.sendFile(path.resolve("index.html"));
});

app.post("/coordinates", (req, res) => {
    let address = req.body.address;

    // Prevent CRLF Attacks
    address = encodeURI(address.replaceAll(/(\r)?\n/g, ""));

    fetch(`https://geocoding.geo.census.gov/geocoder/locations/onelineaddress?address=${address}&benchmark=4&format=json`).then((e) => {
        return e.json();
    }).then(async (e) => {
        if (e.result.addressMatches) {
            const address = e.result.addressMatches[0].coordinates;
            const coordX = address.x;
            const coordY = address.y;
            console.log("Location found");

            const uri = await getForecastUri(coordX, coordY);
            const descriptors = await getWeatherDescriptors(uri);
            const token = await getToken();
            let allSongs = await getAllSongs(descriptors, token);
            
            allSongs.sort((a, b) => {return a["index"]-b["index"];});
            res.json({days: allSongs});
        }
        else {
            console.log(e);
            throw new Error("An Error occurred :(");
        }
    }).catch((e) => {
        res.json({error: e.message});
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
    return new Promise((resolve) => {
        fetch(`https://api.weather.gov/points/${y},${x}`).then((e) => {
            return e.json();
        }).then((e) => {
            if (e.properties) {
                console.log("Gridpoints found");
                resolve(e.properties.forecast);
            }
            else {
                console.log(e);
                throw new Error("An Error occurred :(");
            }
        });
    });
}

const getWeatherDescriptors = (uri) => {
    return new Promise((resolve) => {
        fetch(uri).then((e) => {
            return e.json();
        }).then((e) => {
            if (e.properties) {
                let data = e.properties.periods;
                let forecasts = data.map((datum) => {
                    return datum.shortForecast;
                });

                console.log("Weather found");
                resolve(forecasts);
            }
            else {
                console.log(e);
                throw new Error("An Error occurred :(");
            }
        });
    });
}

const getToken = () => {
    const the_body = new URLSearchParams();
    the_body.append("grant_type", "client_credentials");
    the_body.append("client_id", process.env.client_id);
    the_body.append("client_secret", process.env.client_secret);

    return new Promise((resolve) => {
        fetch(`https://accounts.spotify.com/api/token`, {
            method: "POST",
            body: the_body
        }).then((e) => {
            return e.json();
        }).then((e) => {
            if (e.error) {
                console.log(e);
                throw new Error("An Error occurred :(");
            }
            else {
                console.log("Token found");
                resolve(e);
            }
        });
    });
}

const searchForSongs = (term, index, token) => {
    let the_headers = new Headers();
    the_headers.append("Authorization", `${token.token_type} ${token.access_token}`);

    return new Promise((resolve) => {
        fetch(`https://api.spotify.com/v1/search?q=tag:${term}&type=track&market=US&limit=5`, {
            headers: the_headers
        }).then((e) => {
            return e.json();
        }).then((e) => {
            if (e.error) {
                console.log(e);
                throw new Error("An Error occurred :(");
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
        });
    });
}

app.listen(4000, () => {console.log("Server running on port 4000")});