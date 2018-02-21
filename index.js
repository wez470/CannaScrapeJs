

var scrape = function() {
    var searchStrain = 'cherry kush';
    leaflyRevs = scrapeLeafly(searchStrain);
    allbudRevs = scrapeAllbud(searchStrain);
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
    console.log(revs);
}

var scrapeLeafly = function(searchStrain) {
    return {'cherry kush': {rating: 4.4, ratings: 100}, 'cherry mountain': {rating: 3, ratings: 9}};
}

var scrapeAllbud = function(searchStrain) {
    return {'cherry kush': {rating: 4.0, ratings: 100}, 'cherry pie': {rating: 5, ratings: 27}};
}

scrape();
