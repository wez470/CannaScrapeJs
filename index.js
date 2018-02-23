const axios = require('axios');
const cheerio = require('cheerio');

var scrape = function(searchStrain) {
    var escapedSearch = searchStrain.replace(/ /g, '+');
    var promises = []
    // promises.push(axios.get('https://www.leafly.com/search?q=' + escapedSearch + '&typefilter=strain')
    //     .then(function (response) {
    //         return scrapeLeafly(response.data, escapedSearch);
    //     })
    //     .catch(function (error) {
    //         console.log(error);
    //     }));
    promises.push(axios.get('https://www.allbud.com/marijuana-strains/search?q=' + escapedSearch)
        .then(function (response) {
            return scrapeAllbud(response.data, escapedSearch);
        })
        .catch(function (error) {
            console.log(error);
        }));
    Promise.all(promises).then(function (values) {
        var leaflyRevs = {};
        var allbudRevs = values[0]; // TODO: change to 1

        var responseData = getResponseData(leaflyRevs, allbudRevs);
        console.log(responseData);
    });
}

var scrapeLeafly = function(response, escapedSearch) {
    return {'cherry kush': {rating: 4.4, ratings: 100}, 'cherry mountain': {rating: 3, ratings: 9}};
}

var scrapeAllbud = function(response, escapedSearch) {
    var strainUrls = []
    var $ = cheerio.load(response);
    $('#search-results').find('.object-title a').each(function (index, element) {
        strainUrls.push($(element).attr('href'));
    });
    strainUrls = strainUrls.filter(function (url) {
        for (term of escapedSearch.split('+')) {
            if (!url.includes(term)) {
                return false;
            }
        }
        return true;
    })

    promises = []
    for (strainUrl of strainUrls) {
        var url = 'https://www.allbud.com' + strainUrl
        promises.push(axios.get(url)
            .then(function (res) {
                return scrapeAllbudReview(res.data, res.config.url);
            })
            .catch(function (error) {
                console.log(error);
            }));
    }

    return Promise.all(promises).then(function (values) {
        strainData = {}
        values.forEach(function (currData) {
            for (var strain in currData) {
                strainData[strain] = currData[strain];
            }
        });
        return strainData;
    });
}

var scrapeAllbudReview = function (response, strainUrl) {
    var $ = cheerio.load(response); 
    var strainRating = $('.rating-num').first().text().trim();
    var numRatings = $('#product-rating-votes').first().text().trim();
    var splitUrl = strainUrl.split('/');
    var name = splitUrl[splitUrl.length - 1].replace(/-/g, ' ');
    var strainData = {}
    strainData[name] = {rating: strainRating, ratings: numRatings, url: strainUrl};
    return strainData;
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
