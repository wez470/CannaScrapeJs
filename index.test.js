var rewire = require('rewire');
var index = rewire('./index.js');

var getResponseData = index.__get__('getResponseData');

test('getResponseData returns {} with no reviews', () => {
    expect(getResponseData({}, {})).toEqual({});
});

test('getResponseData aggregates reviews properly', () => {
    allbudRevs = {
        'test strain': {
            rating: 4.0,
            ratings: 50,
            url: 'https://www.allbud.com/marijuana-strains/hybrid/test-strain'
        },
        'all strain': {
            rating: 4.8,
            ratings: 4,
            url: 'https://www.allbud.com/marijuana-strains/indica-dominant-hybrid/all-strain'
        },
    }

    leaflyRevs = {
        'test strain': {
            rating: 3,
            ratings: 50,
            url: 'https://www.leafly.com/hybrid/test-strain'
        },
        'leaf strain': {
            rating: 4.6,
            ratings: 106,
            url: 'https://www.leafly.com/indica/leaf-strain'
        }
    }

    expected = {
        'test strain': {
            leafly: {
                rating: 3.0,
                ratings: 50,
                url: 'https://www.leafly.com/hybrid/test-strain'
            },
            allbud: {
                rating: 4.0,
                ratings: 50,
                url: 'https://www.allbud.com/marijuana-strains/hybrid/test-strain'
            },
            metachronic: {
                rating: 3.5,
                ratings: 100
            }
        },
        'all strain': {
            allbud: {
                rating: 4.8,
                ratings: 4,
                url: 'https://www.allbud.com/marijuana-strains/indica-dominant-hybrid/all-strain'
            }
        },
        'leaf strain': {
            leafly: {
                rating: 4.6,
                ratings: 106,
                url: 'https://www.leafly.com/indica/leaf-strain'
            }
        }
    }

    expect(getResponseData(leaflyRevs, allbudRevs)).toEqual(expected);
});