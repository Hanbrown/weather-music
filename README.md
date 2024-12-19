## Weather Music
This app takes as input a location, and then generates a playlist of music based on the weather for the next 14 days.

### Installation
```
npm install
touch .env

```

Add Spotify client_id and client_secret to `.env`. 

### Dependencies
In addition to `package.json`,
- Weather.gov points and gridpoints API
- Census.gov geocoder API
- Spotify search API

### Endpoints
* `/`
  * Method: GET
  * Parameters:
    - _(None)_
  * Returns:
    - The `index.html` page
<br>

* `/coordinates`
  *  Method: POST
  *  Parameters:
     - address _(required)_: A string containing a valid US street address. Apartment, Suite, etc. not necessary.
  * Returns:
    - A JSON object with the structure
    ```
    {
        days: [
            {
                index: [number],
                forecast: [string],
                songs: [
                    {
                        name: [string],
                        uri: [string], ## Note that this is a Spotify internal URI
                        image: {
                            height: 300,
                            width: 300,
                            url: [string], ## Note the spelling, note that this is a HTTP link
                        }
                    },
                    ... 5 times total
                ]
            },
            ...14 times total
        ]
    }
    ```

---
Created by Pranav Rao vanarp.com