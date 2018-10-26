DROP TABLE IF EXISTS weather;
DROP TABLE IF EXISTS yelp;
DROP TABLE IF EXISTS movies;
DROP TABLE IF EXISTS meetups;
DROP TABLE IF EXISTS trails;
DROP TABLE IF EXISTS locations;

CREATE TABLE locations (
  id SERIAL PRIMARY KEY,
  search_query TEXT,
  formatted_query TEXT,
  latitude NUMERIC(9,7),
  longitude NUMERIC(10,7)
);

CREATE TABLE weather (
  id SERIAL PRIMARY KEY,
  forecast TEXT,
  time TEXT,
  created_at BIGINT,
  location_id INTEGER NOT NULL REFERENCES locations(id)
);

CREATE TABLE yelp (
  id SERIAL PRIMARY KEY,
  name TEXT,
  image_url TEXT,
  price TEXT,
  rating NUMERIC(3,2),
  url TEXT,
  created_at BIGINT,
  location_id INTEGER NOT NULL REFERENCES locations(id)
);

CREATE TABLE movies (
  id SERIAL PRIMARY KEY,
  title TEXT,
  overview TEXT,
  average_votes NUMERIC(4,2),
  total_votes INTEGER,
  image_url TEXT,
  popularity NUMERIC(4,3),
  released_on TEXT,  
  created_at BIGINT,
  location_id INTEGER NOT NULL REFERENCES locations(id)
);

CREATE TABLE meetups (
  id SERIAL PRIMARY KEY,
  link TEXT,
  name TEXT,
  creation_date TEXT,
  host TEXT,
  created_at BIGINT,
  location_id INTEGER NOT NULL REFERENCES locations(id)
);

CREATE TABLE trails (
  id SERIAL PRIMARY KEY,
  name TEXT,
  location TEXT,
  length NUMERIC(5,3),
  stars NUMERIC(3, 2),
  star_votes INTEGER,
  summary TEXT,
  trail_url TEXT,
  conditions TEXT,
  condition_date TEXT,
  condition_time TEXT,
  created_at BIGINT,
  location_id INTEGER NOT NULL REFERENCES locations(id)
);