/// <reference path="../libs/node.d.ts" />
/// <reference path="interfaces.ts" />
var path = require('path');
var gui = require('nw.gui');
var fs = require('fs');
var iconv = require('iconv-lite');
var Q = require('q');
var request = require('request');
var xml2js = require('xml2js');
var xmlParser = new xml2js.Parser();
var folder = path.dirname(process.execPath);
//gui.Window.get().showDevTools();
var config = getConfig();
var rambler = {
    movies: {},
    sessions: []
};
start();
function start() {
    fetchMovies().then(fetchSessions).then(parseSessions).then(writeOutput).catch(function (err) {
        console.log(err);
    }).done(function (data) {
        setTimeout(start, 5000);
    });
}
/**
 * fetch movies from rambler api and return a promise with array of all found movies
 * @returns {Promise<T>}
 */
function fetchMovies() {
    return Q.Promise(function (resolve, reject, notify) {
        var movies = {};
        var promises = [];
        [1, 2, 3].forEach(function (index) {
            var deferred = Q.defer();
            request.get(config.linkMovies.replace('{{num}}', String(index)), function (err, res, body) {
                if (err) {
                    deferred.reject(err);
                }
                else {
                    xmlParser.parseString(body, function (err, body) {
                        if (body.hasOwnProperty('Creations')) {
                            body.Creations.Creation.forEach(function (movie) {
                                movies[movie.ObjectID[0]] = {
                                    ObjectID: movie.ObjectID[0],
                                    ClassType: movie.ClassType[0],
                                    Name: movie.Name[0],
                                    AgeRestriction: (movie.AgeRestriction[0] || '0') + '+',
                                    Year: movie.Year[0],
                                    Duration: movie.Duration[0]
                                };
                            });
                        }
                    });
                    deferred.resolve(body);
                }
            });
            promises.push(deferred.promise);
        });
        Q.all(promises).catch(function (err) {
            reject(err);
        }).done(function (data) {
            rambler.movies = movies;
            resolve();
        });
    });
}
/**
 * Fetch all available sessions for today for a specific Cinema Theater and return them as Sessions
 * @returns {Promise<T>}
 */
function fetchSessions() {
    return Q.Promise(function (resolve, reject, notify) {
        request(config.linkSchedule, function (err, res, body) {
            var sessions = {};
            var all = JSON.parse(body);
            all.List.forEach(function (session) {
                var id = session.CreationObjectID + session.Format;
                var hallName = session.HallName.replace(/[\D]/g, '');
                if (!sessions.hasOwnProperty(id)) {
                    sessions[id] = {
                        'name': rambler.movies[session.CreationObjectID].Name,
                        'age': rambler.movies[session.CreationObjectID].AgeRestriction,
                        'duration': rambler.movies[session.CreationObjectID].Duration,
                        'format': session.Format,
                        'sessions': [session.DateTime.split(' ')[1]],
                        'prices': [session.MinPrice],
                        'halls': [hallName]
                    };
                }
                else {
                    if (sessions[id]['sessions'].indexOf(session.DateTime.split(' ')[1]) === -1) {
                        sessions[id]['sessions'].push(session.DateTime.split(' ')[1]);
                        sessions[id]['prices'].push(session.MinPrice);
                        sessions[id]['halls'].push(hallName);
                    }
                }
            });
            resolve(sessions);
        });
    });
}
/**
 * Pasre movies and return string representation of all data.
 * We should split a movie in 2 if there are more that 10 sessions
 * @param sessions
 * @returns {string} - output data ready for writing
 */
function parseSessions(sessions) {
    var master = '';
    var num = 1;
    var sortedKeys = Object.keys(sessions).sort();
    rambler.movieCount = sortedKeys.length;
    for (var key in sortedKeys) {
        if (sessions.hasOwnProperty(sortedKeys[key])) {
            var movie = sessions[sortedKeys[key]];
            movie.sessions = sortSessions(sessions[sortedKeys[key]].sessions);
            if (movie.sessions.length <= 10) {
                master += config.csv.replace('{{num}}', String(num)).replace('{{name}}', movie.name).replace('{{format}}', movie.format).replace('{{ageRestriction}}', movie.age).replace('{{sessions}}', movie.sessions.join(';')).replace('{{prices}}', movie.prices.join(';')).replace('{{halls}}', movie.halls.join(';'));
            }
            else {
                master += config.csv.replace('{{num}}', String(num)).replace('{{name}}', movie.name).replace('{{format}}', movie.format).replace('{{ageRestriction}}', movie.age).replace('{{sessions}}', movie.sessions.splice(0, 10).join(';')).replace('{{prices}}', movie.prices.splice(0, 10).join(';')).replace('{{halls}}', movie.halls.splice(0, 10).join(';')) + config.csv.replace('{{num}}', String(num)).replace('{{name}}', movie.name).replace('{{format}}', movie.format).replace('{{ageRestriction}}', movie.age).replace('{{sessions}}', movie.sessions.join(';')).replace('{{prices}}', movie.prices.join(';')).replace('{{halls}}', movie.halls.join(';'));
            }
            num++;
        }
    }
    return master;
    function sortSessions(sessionTimes) {
        var dateArray = [];
        var sessionStrings = [];
        sessionTimes.forEach(function (item) {
            var time = item.split(':');
            var date = new Date();
            date.setHours(time[0]);
            date.setMinutes(time[1]);
            if (date.getHours() <= 6) {
                date.setDate(date.getDate() + 1);
            }
            dateArray.push(date);
        });
        dateArray.sort(function (a, b) {
            return a.getTime() - b.getTime();
        });
        dateArray.forEach(function (date) {
            var h = String(date.getHours());
            var m = String(date.getMinutes());
            h = h.length === 1 ? '0' + h : h;
            m = m.length === 1 ? '0' + m : m;
            sessionStrings.push(h + ':' + m);
        });
        return sessionStrings;
    }
}
function writeOutput(master) {
    try {
        fs.writeFileSync(path.resolve(config.outputCSVPath), iconv.encode(master, 'win1251'));
        fs.writeFileSync(path.resolve(config.outputFilmcountPath), iconv.encode(String(rambler.movieCount), 'win1251'));
    }
    catch (e) {
        throw new Error(e);
    }
}
function getConfig() {
    var data = JSON.parse(iconv.decode(fs.readFileSync(path.resolve(folder, 'config.json')), 'win1251'));
    var date = new Date();
    data.datefrom = String(date.getFullYear()) + '-' + String(date.getMonth() + 1) + '-' + String(date.getDate());
    data.linkMovies = data.linkMovies.replace('{{key}}', data.key);
    data.linkSchedule = data.linkSchedule.replace('{{key}}', data.key).replace('{{objectId}}', String(data.objectId)).replace('{{dateFrom}}', data.datefrom).replace('{{dateTo}}', data.dateto).replace('{{cityId}}', data.cityid).replace('{{salesupportedonly}}', data.salesupportedonly);
    return data;
}
document.onkeyup = function (event) {
    if (event.keyCode === 123) {
        gui.Window.get().showDevTools();
    }
    if (event.keyCode === 116) {
        gui.Window.get().reload();
    }
    if (event.keyCode === 27 || event.keyCode === 126) {
        gui.Window.get().close();
    }
};
//# sourceMappingURL=main.js.map