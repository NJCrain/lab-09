'use strict';

const express = require('express');
const cors = require('cors');
const superagent = require('superagent');
const pg = require('pg');

require('dotenv').config();

const PORT = process.env.PORT || 3000;

const client = new pg.Client(process.env.DATABASE_URL);
client.connect();
client.on('err', err => console.log(err));

const app = express();

app.use(cors());

app.get('/weather', searchWeatherData);
app.get('/yelp', getYelp);
app.get('/movies', getMovies);
app.get('/meetups', getMeetups);
app.get('/trails', getTrails);

app.get('/location', searchToLatLong);

function searchToLatLong(req, res) {
  const locationHandler = {
    query: req.query.data,

    cacheHit: results => {
      console.log('Got Data from SQL');
      res.send(results.rows[0]);
    },

    cacheMiss: () => {
      Location.fetchLocation(req.query.data).then( () => {
        let SQL = `SELECT * FROM locations WHERE search_query=$1`
        client.query(SQL, [req.query.data])
          .then( results => {
            res.send(results.rows[0]);
          });
      }
      );
    }
  };

  Location.lookupLocation(locationHandler);
}

Location.lookupLocation = handler => {
  const SQL = `SELECT * FROM locations WHERE search_query=$1`;
  const values = [handler.query];

  return client
    .query(SQL, values)
    .then(result => {
      if (result.rowCount > 0) {
        handler.cacheHit(result);
      } else {
        handler.cacheMiss();
      }
    })
    .catch(console.error);
};

function Location(query, data) {
  this.search_query = query;
  this.formatted_query = data.formatted_address;
  this.latitude = data.geometry.location.lat;
  this.longitude = data.geometry.location.lng;
}
Location.prototype.save = function() {
  let SQL = `INSERT INTO locations (search_query, formatted_query, latitude, longitude) VALUES ($1, $2, $3, $4);`;
  let values = Object.values(this);

  client.query(SQL, values);
};

Location.fetchLocation = query => {
  const URL = `https://maps.googleapis.com/maps/api/geocode/json?address=${query}&key=${
    process.env.GOOGLE_API_KEY
  }`;
  return superagent.get(URL)
    .then(data => {
      console.log('Got Data from API');
      if (!data.body.results.length) {
        throw 'No Data';
      } else {
        let location = new Location(query, data.body.results[0]);
        // console.log(data.body);
        location.save();
        return location;
      }
    })
    .catch(error => handleError(error));
};

//-----------------------------------------------------WEATHER-----------------------------------------------------------------

function searchWeatherData(req, res) {


  const handler = {

    location: req.query.data,

    cacheHit: function(result) {
      res.send(result.rows);
    },

    cacheMiss: function() {
      Weather.fetch(req.query.data)
        .then(result => {
          res.send(result);
        })
        .catch(console.error);
    },
  };
  Weather.lookup(handler);
}

function Weather(day) {
  this.time = new Date(day.time * 1000).toString().slice(0, 15);
  this.forecast = day.summary;
  // console.log(data.summary);
}

Weather.prototype.save = function(id) {
  const SQL = `INSERT INTO weather (forecast, time, location_id) VALUES ($1, $2, $3);`;
  const values = Object.values(this);
  values.push(id);
  client.query(SQL, values);
};

Weather.lookup = function(handler) {
  const SQL = `SELECT * FROM weather WHERE location_id=$1;`;
  client.query(SQL, [handler.location.id])
    .then(result => {
      if (result.rowCount > 0) {
        console.log('Got Data from SQL');
        handler.cacheHit(result);
      } else {
        console.log('got data from API');
        handler.cacheMiss();
      }
    })
    .catch(error => handleError(error));
};

Weather.fetch = function(location) {
  const URL = `https://api.darksky.net/forecast/${process.env.WEATHER_API_KEY}/${location.latitude},${location.longitude}`;

  return superagent.get(URL)
    .then(result => {
      // console.log(result.body.daily);
      const weatherSummaries = result.body.daily.data.map(day => {
        const summary = new Weather(day);
        summary.save(location.id);
        return summary;
      });
      return weatherSummaries;
    })
    .catch(error => handleError(error));
};

//----------------------------------------------------YELP-----------------------------------------------------------------------

function getYelp(req, res) {

  const handler = {
    location: req.query.data,

    cacheHit: function(result) {
      res.send(result.rows);
    },

    cacheMiss: function() {
      Yelp.fetch(req.query.data)
        .then(result => res.send(result))
        .catch(console.error);
    },
  };

  Yelp.lookup(handler);
}

function Yelp(data) {
  this.name = data.name;
  this.image_url = data.image_url;
  this.price = data.price;
  this.rating = data.rating;
  this.url = this.url;
}

Yelp.prototype.save = function(id) {
  const SQL = `INSERT INTO yelp (name, image_url, price, rating, url, location_id) VALUES ($1, $2, $3, $4, $5, $6);`;
  const value = Object.values(this);
  value.push(id);
  client.query(SQL, value);
}

Yelp.lookup = function(handler) {
  const SQL = `SELECT * FROM yelp WHERE location_id=$1;`;
  client.query(SQL, [handler.location.id])
    .then(result => {
      if (result.rowCount >0 ){
        console.log('Got from SQL')
        handler.cacheHit(result);
      } else {
        console.log('got data from API');
        handler.cacheMiss();
      }
    })
    .catch(error => handleError(error));
};

Yelp.fetch = function(location) {
  const URL = `https://api.yelp.com/v3/businesses/search?term=delis&latitude=${location.latitude}&longitude=${location.longitude}`;

  return superagent.get(URL)
    .set({ Authorization: 'Bearer ' + process.env.YELP_API_KEY })
    .then(result => {
      // console.log(result.body);
      const yelpSummaries = result.body.businesses.map(businesses => {
        const summary = new Yelp(businesses);
        summary.save(location.id);
        return summary;
      });
      return yelpSummaries;
    })
    .catch(error => handleError(error));
};

//-------------------------------------------------------MOVIES----------------------------------------------------------


function getMovies(req, res) {

  const handler = {
    location: req.query.data,

    cacheHit: function(result) {
      res.send(result.rows);
    },

    cacheMiss: function() {
      Movie.fetch(req.query.data)
        .then(result => res.send(result))
        .catch(console.error);
    },
  };

  Movie.lookup(handler);
}

function Movie(data) {
  this.title = data.title;
  this.overview = data.overview;
  this.average_votes = data.vote_average;
  this.total_votes = data.vote_count;
  this.image_url = `https://image.tmdb.org/t/p/w200_and_h300_bestv2${
    data.poster_path
  }`;
  this.popularity = data.popularity;
  this.released_on = data.release_date;
}


Movie.prototype.save = function(id) {
  const SQL = `INSERT INTO movies (title, overview, average_votes, total_votes, image_url, popularity, released_on, location_id) VALUES ($1, $2, $3, $4, $5, $6, $7, $8);`;
  const value = Object.values(this);
  value.push(id);
  client.query(SQL, value);
}

Movie.lookup = function(handler) {
  const SQL = `SELECT * FROM movies WHERE location_id=$1;`;
  client.query(SQL, [handler.location.id])
    .then(result => {
      if (result.rowCount >0 ){
        console.log('Got data from SQL')
        handler.cacheHit(result);
      } else {
        console.log('got data from API');
        handler.cacheMiss();
      }
    })
    .catch(error => handleError(error));
};

Movie.fetch = function(location) {
  let search = location.formatted_query.split(',')[0];

  const URL = `https://api.themoviedb.org/3/search/movie?api_key=${process.env.MOVIES_API_KEY}&query=${search}`;

  return superagent.get(URL)
    .then(result => {
      // console.log(result);
      const movieSummaries = result.body.results.map(movie => {
        const summary = new Movie(movie);
        summary.save(location.id);
        return summary;
      });
      return movieSummaries;
    })
    .catch(error => handleError(error));
};

//-----------------------------------------------------------MEETUPS----------------------------------------------------------

function getMeetups(req, res) {

  const handler = {
    location: req.query.data,

    cacheHit: function(result) {
      res.send(result.rows);
    },

    cacheMiss: function() {
      Meetup.fetch(req.query.data)
        .then(result => res.send(result))
        .catch(console.error);
    },
  };

  Meetup.lookup(handler);
}

function Meetup(data) {
  this.link = data.link;
  this.name = data.name;
  this.creation_date = new Date(data.created).toDateString();
  this.host = data.group.name;
}


Meetup.prototype.save = function(id) {
  const SQL = `INSERT INTO meetups (link, name, creation_date, host, location_id) VALUES ($1, $2, $3, $4, $5);`;
  const value = Object.values(this);
  value.push(id);
  client.query(SQL, value);
}

Meetup.lookup = function(handler) {
  const SQL = `SELECT * FROM meetups WHERE location_id=$1;`;
  client.query(SQL, [handler.location.id])
    .then(result => {
      if (result.rowCount >0 ){
        console.log('Got data from SQL')
        handler.cacheHit(result);
      } else {
        console.log('got data from API');
        handler.cacheMiss();
      }
    })
    .catch(error => handleError(error));
};

Meetup.fetch = function(location) {
  const URL = `https://api.meetup.com/find/upcoming_events?key=${process.env.MEETUP_API_KEY}&lat=${location.latitude}&lon=${location.longitude}`;

  return superagent.get(URL)
    .then(result => {
      const meetupSummaries = result.body.events.map(meetup => {
        const summary = new Meetup(meetup);
        summary.save(location.id);
        return summary;
      });
      return meetupSummaries;
    })
    .catch(error => handleError(error));
};


//--------------------------------------------------TRAILS------------------------------------------------

function getTrails(req, res) {

  const handler = {
    location: req.query.data,

    cacheHit: function(result) {
      res.send(result.rows);
    },

    cacheMiss: function() {
      Trail.fetch(req.query.data)
        .then(result => res.send(result))
        .catch(console.error);
    },
  };

  Trail.lookup(handler);
}

function Trail(data) {
  this.name = data.name;
  this.location = data.location;
  this.length = data.length;
  this.stars = data.stars;
  this.star_votes = data.starVotes;
  this.summary = data.summary;
  this.trail_url = data.url;
  this.conditions = data.conditionStatus
  this.condition_date = new Date(data.conditionDate).toDateString();
  this.condition_time = new Date(data.conditionDate).toTimeString().slice(0, 8);
}


Trail.prototype.save = function(id) {
  const SQL = `INSERT INTO trails (name, location, length, stars, star_votes, summary, trail_url, conditions, condition_date, condition_time, location_id) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11);`;
  const value = Object.values(this);
  value.push(id);
  client.query(SQL, value);
}

Trail.lookup = function(handler) {
  const SQL = `SELECT * FROM trails WHERE location_id=$1;`;
  client.query(SQL, [handler.location.id])
    .then(result => {
      if (result.rowCount >0 ){
        console.log('Got data from SQL')
        handler.cacheHit(result);
      } else {
        console.log('got data from API');
        handler.cacheMiss();
      }
    })
    .catch(error => handleError(error));
};

Trail.fetch = function(location) {
  const URL = `https://www.hikingproject.com/data/get-trails?key=${process.env.TRAILS_API_KEY}&lat=${location.latitude}&lon=${location.longitude}`;

  return superagent.get(URL)
    .then(result => {
      // return result.body;
      const trailSummaries = result.body.trails.map(trail => {
        const summary = new Trail(trail);
        summary.save(location.id);
        return summary;
      });
      return trailSummaries;
    })
    .catch(error => handleError(error));
};

function handleError(err, res) {
  console.error('ERR', err);
  if (res) res.status(500).send('Sorry, something went wrong');
}

app.listen(PORT, () => console.log(`App is up on ${PORT}`));
