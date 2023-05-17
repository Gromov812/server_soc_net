

let mysql = require('mysql');

let connection = mysql.createConnection({
    host     : 'localhost', //mysql database host name
    user     : 'root', //mysql database user name
    password : 'gromok92', //mysql database password
    database : 'costumers' //mysql database name
  });
 

  connection.connect(function(err) {
    if (err) console.log(err);
    console.log('You are now connected with mysql database...')
  }) 

const passport = require('passport');


const JwtStrategy = require('passport-jwt').Strategy;
const ExtractJwt = require('passport-jwt').ExtractJwt;


const options = {
    jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
    secretOrKey: 'some-secret-key'
}

module.exports = passport => {
    passport.use(
        new JwtStrategy(options, (payload, done) => {

            try {
                connection.query('select * from users where id=?', payload.id, function (error, results, fields) {
            
                    if (results.length) {
                        done(null, results[0])
                    }
              
                  else { 
                        done(null, false)
                  }
                  });
            } 
            
            catch (error) {
                console.log(error);
            }

        })
    )
}