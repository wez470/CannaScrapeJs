const axios = require('axios');
const cheerio = require('cheerio');
const Memcached = require('memcached-elasticache');
const memcached = new Memcached('meta-chronic.osck8f.cfg.use1.cache.amazonaws.com:11211');

var DOMAINS = ['https://meta-chronic.com', 'https://weed-exchange.firebaseapp.com']

exports.handler = (event, context, callback) => {
    console.log(event);
    context.callbackWaitsForEmptyEventLoop = false;
    var escapedSearch = escape(event.queryStringParameters.strain);
    console.log("Escaped search", escapedSearch);
    
    const done = (err, res, origin) => callback(null, {
        statusCode: err ? '400' : '200',
        body: err ? err.message : res,
        headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': origin
        },
    });

    if (DOMAINS.indexOf(event.headers.origin) >= 0) {
        memcached.get(escapedSearch, function (err, data) {
            if (typeof err !== 'undefined') {
                console.log(err);
            }

            console.log("Cached data", data);
            if (typeof data !== 'undefined') {
                console.log("Serving cached data");
                if (isEmpty(JSON.parse(data))) {
                    done(null, data, event.headers.origin);
                }
                else {
                    updateLatestSearches(escapedSearch, () => {
                        done(null, data, event.headers.origin);
                    });  
                }

            }

            // Only scrape if we need to. This check is necessary because execution can continue
            // when a container unfreezes / after calling the callback function.
            if (typeof data === 'undefined') {
                console.log("Scraping");
                scrape(escapedSearch).then(function (response) {
                    console.log("Scraped response", response);
                    var stringifiedResponse = JSON.stringify(response);
                    memcached.set(escapedSearch, stringifiedResponse, 3600 * 48, function (err) {
                        if (typeof err !== 'undefined') {
                            console.log(err);
                        }
                        if (isEmpty(response)) {
                            done(null, stringifiedResponse, event.headers.origin);
                        }
                        else {
                            updateLatestSearches(escapedSearch, () => {
                                done(null, stringifiedResponse, event.headers.origin);
                            });  
                        }
                    });
                });
            }
        });
    }
    else {
        done({message: 'No access for domain'}, null, '');
    }
};

var isEmpty = (obj) => {
    return Object.keys(obj).length === 0 && obj.constructor === Object
}

var scrape = function(escapedSearch) {
    var promises = [];
    promises.push(axios.get('https://www.leafly.com/search?q=' + escapedSearch + '&typefilter=strain')
        .then(function (response) {
            return scrapeLeafly(response.data, escapedSearch);
        })
        .catch(function (error) {
            console.log(error);
        }));
    promises.push(axios.get('https://www.allbud.com/marijuana-strains/search?q=' + escapedSearch)
        .then(function (response) {
            return scrapeAllbud(response.data, escapedSearch);
        })
        .catch(function (error) {
            console.log(error);
        }));
    return Promise.all(promises).then(function (values) {
        var leaflyRevs = values[0];
        var allbudRevs = values[1];

        var responseData = getResponseData(leaflyRevs, allbudRevs);
        return responseData;
    });
};

var scrapeLeafly = function(response, escapedSearch) {
    var $ = cheerio.load(response);
    var names = [];
    var ratingList = [];
    var numRatingsList = [];
    var urls = [];

    $('.results-section .result-container a').filter(function (i, elem) {
        return $(this).children('.type').text() === 'strain'
    }).each(function (i, elem) {
        urls.push($(this).attr('href'));

        names.push($(this).children('.name').text().trim().toLowerCase());

        var reviewCountStr = $(this).children('.container').children('.rating-section').children('.review-count').text().trim();
        numRatingsList.push(Number(reviewCountStr.slice(1, -1)));


        var ratingStr = $(this).children('.container').children('.rating-section').children('.rating').text().trim();
        ratingList.push(Number(ratingStr));
    })

    var strainData = {};
    var unescapedSearch = unescape(escapedSearch).replace(/\'s/g, '');
    for (var i = 0; i < names.length; i++) {
        var validStrain = true;
        for (var term of unescapedSearch.split(' ')) {
            if (!names[i].includes(term)) {
                validStrain = false;
                break;
            }
        }

        if (validStrain) {
            strainData[names[i]] = {rating: ratingList[i], ratings: numRatingsList[i], url: urls[i]};
        }
    }
    return strainData;
};

var scrapeAllbud = function(response, escapedSearch) {
    var strainUrls = [];
    var $ = cheerio.load(response);
    $('#search-results').find('.object-title a').each(function (index, element) {
        strainUrls.push($(element).attr('href'));
    });
    var unescapedSearch = unescape(escapedSearch).replace(/\'s/g, '');
    strainUrls = strainUrls.filter(function (url) {
        for (var term of unescapedSearch.split(' ')) {
            if (!url.includes(term)) {
                return false;
            }
        }
        return true;
    });

    var promises = [];
    for (var strainUrl of strainUrls) {
        var url = 'https://www.allbud.com' + strainUrl;
        promises.push(axios.get(url)
            .then(function (res) {
                return scrapeAllbudReview(res.data, res.config.url);
            })
            .catch(function (error) {
                console.log(error);
            }));
    }

    return Promise.all(promises).then(function (values) {
        var strainData = {};
        values.forEach(function (currData) {
            for (var strain in currData) {
                strainData[strain] = currData[strain];
            }
        });
        return strainData;
    });
};

var scrapeAllbudReview = function (response, strainUrl) {
    var $ = cheerio.load(response); 
    var strainRating = $('.rating-num').first().text().trim();
    var numRatings = $('#product-rating-votes').first().text().trim();
    var name = $('.col-xs-12 h1').first().text().trim().toLowerCase();
    var strainData = {};
    strainData[name] = {rating: Number(strainRating), ratings: Number(numRatings), url: strainUrl};
    return strainData;
};

var getResponseData = function(leaflyRevs, allbudRevs) {
    var revs = {};
    for (var strain in leaflyRevs) {
        if (!(strain in revs)) {
            revs[strain] = {};
        }
        revs[strain].leafly = leaflyRevs[strain];
    }
    for (var strain in allbudRevs) {
        if (!(strain in revs)) {
            revs[strain] = {};
        }
        revs[strain].allbud = allbudRevs[strain];
    }
    for (var strain in revs) {
        if (Object.keys(revs[strain]).length > 1) {
            var rating = 0;
            var totalRatings = 0;
            for (var source in revs[strain]) {
                rating += revs[strain][source].rating * revs[strain][source].ratings;
                totalRatings += revs[strain][source].ratings;
            }
            var avgRating = rating / totalRatings;
            revs[strain].metachronic = { rating: avgRating, ratings: totalRatings };
        }
    }
    return revs;
};

var updateLatestSearches = (escapedSearch, callback) => {
    memcached.get('latestSearches', function (err, data) {
        if (typeof err !== 'undefined') {
            console.log(err);
            return [];
        }

        let latestSearches = []
        if (typeof data !== 'undefined') {
            latestSearches = JSON.parse(data);
        }
            
        console.log("Current latest searches", latestSearches);
        let unescapedSearch = unescape(escapedSearch)
        if (latestSearches.indexOf(unescapedSearch) >= 0) {
            callback();
        }
        else {
            latestSearches.unshift(unescapedSearch);
            if (latestSearches.length > 10) {
                latestSearches.splice(10 - latestSearches.length);
            }
            
            memcached.set('latestSearches', JSON.stringify(latestSearches), 3600 * 24 * 30, function (err) {
                if (typeof err !== 'undefined') {
                    console.log(err);
                }
                callback();
            });    
        }
    });
}
