const axios = require('axios');

var scrape = function(searchStrain) {
    var escapedSearch = searchStrain.replace(/ /g, '+');
    var promises = []
    promises.push(axios.get('https://www.leafly.com/search?q=' + escapedSearch + '&typefilter=strain')
        .then(function (response) {
            console.log("Leafly response handler");
            return scrapeLeafly(response);
        })
        .catch(function (error) {
            console.log(error);
        }));
    promises.push(axios.get('https://www.leafly.com/search?q=' + escapedSearch + '&typefilter=strain')
        .then(function (response) {
            console.log("Allbud response handler");
            return scrapeAllbud(response);
        })
        .catch(function (error) {
            console.log(error);
        }));
    Promise.all(promises).then(function (values) {
        var leaflyRevs = values[0];
        var allbudRevs = values[1];

        var responseData = getResponseData(leaflyRevs, allbudRevs);
        console.log(responseData);
    });
}

var scrapeLeafly = function(searchStrain) {
    return {'cherry kush': {rating: 4.4, ratings: 100}, 'cherry mountain': {rating: 3, ratings: 9}};
}

var scrapeAllbud = function(searchStrain) {
    return {'cherry kush': {rating: 4.0, ratings: 100}, 'cherry pie': {rating: 5, ratings: 27}};
}

var getResponseData = function(leaflyRevs, allbudRevs) {
    var revs = {}
    for (strain in leaflyRevs) {
        if (!(strain in revs)) {
            revs[strain] = {};
        }
        revs[strain].leafly = leaflyRevs[strain];
    }
    for (strain in allbudRevs) {
        if (!(strain in revs)) {
            revs[strain] = {};
        }
        revs[strain].allbud = allbudRevs[strain];
    }
    for (strain in revs) {
        if (Object.keys(revs[strain]).length > 1) {
            var rating = 0;
            var totalRatings = 0;
            for (source in revs[strain]) {
                rating += revs[strain][source].rating * revs[strain][source].ratings;
                totalRatings += revs[strain][source].ratings;
            }
            var avgRating = rating / totalRatings;
            revs[strain].metachronic = { rating: avgRating, ratings: totalRatings };
        }
    }
    return revs;
}

scrape('cherry kush');
