const axios = require('axios');
const cheerio = require('cheerio');

var DOMAINS = ['https://meta-chronic.com', 'https://weed-exchange.firebaseapp.com']

exports.handler = (event, context, callback) => {
    console.log(event);
    const done = (err, res, origin) => callback(null, {
        statusCode: err ? '400' : '200',
        body: err ? err.message : JSON.stringify(res),
        headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': origin
        },
    });
    
    if (DOMAINS.indexOf(event.headers.origin) >= 0) {
        var strain = event.queryStringParameters.strain;
        scrape(strain).then(function (response) {
            done(null, response, event.headers.origin);
        });
    }
    else {
        done({message: 'No access for domain'}, null, '');
    }
};

var scrape = function(searchStrain) {
    var escapedSearch = searchStrain.replace(/ /g, '+');
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
    $('li .padding-rowItem a').each(function (i, elem) {
        urls.push('https://www.leafly.com' + $(this).attr('href').trim());
    });
    for (var url of urls) {
        var splitUrl = url.split('/');
        var name = splitUrl[splitUrl.length - 1].replace(/-/g, ' ');
        names.push(name);
    }
    $('li .padding-rowItem .color--light').each(function (i, elem) {
        numRatingsList.push(Number($(this).text().trim().substr(1).split(' ')[0]));
    });
    $('li .padding-rowItem img').each(function (i, elem) {
        ratingList.push(Number($(this).attr('src').split('/')[2]));
    });

    var strainData = {};
    for (var i = 0; i < names.length; i++) {
        var validStrain = true;
        for (var term of escapedSearch.split('+')) {
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
    strainUrls = strainUrls.filter(function (url) {
        for (var term of escapedSearch.split('+')) {
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
    var splitUrl = strainUrl.split('/');
    var name = splitUrl[splitUrl.length - 1].replace(/-/g, ' ');
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