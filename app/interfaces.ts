interface Config {
    outputCSVPath:string;
    outputFilmcountPath:string;
    objectId:number;
    cityid:string;
    datefrom: string;
    dateto: string;
    linkMovies: string;
    linkSchedule: string;
    key: string;
    salesupportedonly:string;
    csv: string;
    hall_rm: string;
}

interface MoviesXML {
    Creations: {
        Creation: Array<Movie>;
    };
}

interface Movies {
    [name:string] : Movie;
}

interface Movie {
    ObjectID: string;
    ClassType: string;
    Name: string;
    AgeRestriction:string;
    Year: string;
    Duration: string;
}

interface Rambler {
    movies: Movies;
    sessions: Array<Session>;
    movieCount:number;
}

interface Sessions {
    [id:string]: Session
}

interface Session {
    name: string;
    age: string;
    duration:string;
    format:string;
    sessions:Array<string>;
    prices:Array<string>;
    halls:Array<string>;
}
