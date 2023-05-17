let express = require('express');
let app = express();
let mysql = require('mysql');
let cors = require('cors');
var bodyParser = require('body-parser');
var mysqlAdmin = require('node-mysql-admin');
var passwordHash = require('password-hash');
var jwt = require('jsonwebtoken');
var passport = require('passport');
let fileUpload = require('express-fileupload');
const path = require('path');


app.use(cors())
app.use(fileUpload({
  createParentPath: true,
}));
app.use(express.static(path.join(__dirname, '/client/public')));
//start mysql connection
let db = mysql.createConnection({
  host: 'localhost', //mysql database host name
  user: 'root', //mysql database user name
  password: 'gromok92', //mysql database password
  database: 'costumers' //mysql database name
});

const { promisify } = require('util');
const query = promisify(db.query).bind(db);

db.connect(function (err) {
  if (err) console.log(err);
  console.log('You are now connected with mysql database...')
})
//end mysql connection 

app.use(passport.initialize())
require('./middleware/passport')(passport)

app.use(mysqlAdmin(app));
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());




app.get('/api', function (req, res) {
  res.send('API is running');
});
//create app server
app.listen(3005, "localhost", function () {

  console.log("Example app listening on port 3005")

});
// test

app.get('/test', passport.authenticate('jwt', { session: false }), function (req, res) {
  res.status(200).json({
    message: 'ALL GOOD, 200!'
  })
})


// upload files 
app.post('/upload', function (req, res) {

  if (!req.files.file) return res.status(400).send('No file uploaded');
  const file = req.files.file;
  const id = req.body.id;
  if (!file) return res.send('Incorrect input name');

  const newFileName = encodeURI(file.name);

  file.mv(`${__dirname}/client/public/uploads/${id}/${req.query.type}_${newFileName}`, err => {
    if (err) return res.status(500).send(err);

    if (req.query.type == 'photo') db.query(`UPDATE users SET photo = ? WHERE id = ?`, [`http://127.0.0.1:3005/uploads/${id}/${req.query.type}_${newFileName}`, id])
    if (req.query.type == 'profile_background') db.query(`UPDATE users SET profile_background = ? WHERE id = ?`, [`http://127.0.0.1:3005/uploads/${id}/${req.query.type}_${newFileName}`, id])


    res.json({
      filename: file.name,
      filePath: `http://127.0.0.1:3005/uploads/${id}/${req.query.type}_${newFileName}`
    })
  })



})



//rest api to get all customers
app.get('/users', passport.authenticate('jwt', { session: false }), function (req, res) {
  db.query('select * from users', function (error, results, fields) {

    let totalUsers = results.length;
    let totalPages = Math.ceil(totalUsers / 5);
    let page = req.query.page || 1;
    let limit = req.query.limit || 5;
    let usersArray = results.splice((page - 1) * limit, limit);

    if (error) res.send(error)

    else {
      db.query('SELECT name, id, photo from users WHERE users.id in (SELECT followId from users_followers WHERE userId=?)', +req.query.id, function (error, result, fields) {

        if (error) res.status(400)
        else {
          res.status(200).json({
            friends: result,
            params: req.query.page,
            page: page,
            totalPages: totalPages,
            totalUsers: totalUsers,
            limitPerPage: limit,
            users: usersArray
          })
        }
      })
    }
  });
});
//rest api to get a single customer data
app.get('/users/:id', function (req, res) {
  db.query('select * from users where id=?', req.params.id, function (error, results, fields) {
    if (error) res.send(`ERRER >>> ` + error)

    else {
      res.send(results[0]);

    }
  });
});
// update user avatar
app.post('/update_user_avatar', (req, res) => {
  db.query('UPDATE users SET photo = ? WHERE id = ?', [req.body.photo, req.body.id], (err, result) => {
    if (err) res.status(400).send(`error >>> ${err}`);
    res.send('all good!')
  })
})
// update user settings 
app.post('/update_user_settings', passport.authenticate('jwt', { session: false }), function (req, res) {

  db.query('UPDATE users SET name = ?, email = ?, info = ? WHERE id = ?', [req.body.settings.name, req.body.settings.email, JSON.stringify(req.body.settings.info), req.body.id], function (error, results, fields) {
    if (error) res.send(error)
    else res.status(200).send('Settings updated!')
  }) 
})
// update user status

app.post('/update_user_status', passport.authenticate('jwt', { session: false }), function (req, res) {
  // console.log(req.body);
  db.query('UPDATE users SET status = ? WHERE id = ?', [req.body.statusText, req.body.id], function (error, result) {
    if (error) res.send(error)
    else res.status(200).send('status updated!')
  })

})

// get user wall posts
app.get('/user_wall_posts', function (req, res) {
  db.query('SELECT users_wall_posts.id, users_wall_posts.message, users_wall_posts.from_id, users_wall_posts.to_id, users_wall_posts.updated, users_wall_posts.likes, users.name FROM users_wall_posts, users WHERE users.id = users_wall_posts.from_id AND users_wall_posts.to_id = ? ORDER BY users_wall_posts.updated DESC;', req.query.to, function (error, results, fields) {
    // console.log(`POSTS >>> `,results);
    if (error) res.status(400).send(error);
    else {
      return res.status(200).json({
        posts: results
      })
    }
  })

})

app.post('/filteredUsers', function (req, res) {
  db.query(`SELECT * FROM users WHERE name LIKE ?`, req.body.name, function (err, result) {

    let totalUsers = result.length;
    let totalPages = Math.ceil(totalUsers / 10);
    let page = req.body.page || 1;
    let limit = req.body.limit || 5;
    let usersArray = result.splice((page - 1) * limit, limit);

    if (err) res.send(`ERROR >> ${err}`)
    else res.status(200).json({
      friends: result,
      params: req.query.page,
      page: page,
      totalPages: totalPages,
      totalUsers: totalUsers,
      limitPerPage: limit,
      users: usersArray
    })
  })
})

//upd post
// SELECT users_wall_posts.id, users.name FROM users_wall_posts, users WHERE users_wall_posts.from_id = users.id AND users_wall_posts.from_id = 39;

// add user wall post into db

app.post('/user_wall_posts', function (req, res) {

  db.query('INSERT INTO users_wall_posts (from_id, to_id, message, likes) VALUES (?,?,?,?)', [req.body.from, req.body.to, req.body.message, JSON.stringify([])], function (error, results, fields) {
    if (error) res.status(400).send(error);
    else {
      return res.status(200).json({
        results: results
      })
    }
  })
})

// get user friend by his id (id get from cookies if it's not expired)

// app.get('/test', function (req, res) {
//   res.send(JSON.stringify(req))
// })


app.get('/user/friends', passport.authenticate('jwt', { session: false }), function (req, res) {


  db.query('SELECT name, id from users WHERE users.id in (SELECT followId from users_followers WHERE userId=?)', +req.query.id, function (error, result, fields) {

    if (error) res.status(400)
    else {
      res.status(200).json({
        friends: result
      })
    }
  })



})

// Add user to friends

app.get(`/getMessages`, function (req, res) {
  db.query(`SELECT * FROM primary_messages WHERE from_id = ${req.query.from_id} AND to_id = ${req.query.to_id} OR from_id = ${req.query.to_id} AND ${req.query.from_id};`, (err, results) => {
    console.log(results[0]);
    res.send(results)
  })

}) 

// get all messages of choosen conversation
app.get('/messages/get', function (req, res) {
  db.query(`(SELECT sent, message, from_id, to_id as contragent_id, conversation, name FROM primary_messages JOIN users ON users.id = to_id WHERE from_id = ${req.query.ownerId} AND to_id = ${req.query.userId}
    UNION ALL
    SELECT sent, message, from_id as contragent_id, to_id, conversation, name FROM primary_messages JOIN users ON users.id = from_id WHERE to_id = ${req.query.ownerId} AND from_id = ${req.query.userId})
    ORDER BY sent ASC`, (err, result) => {

    if (err) res.send(err);
    // db.query(`UPDATE primary_messages SET unread_counter = 0 WHERE to_id = ${req.query.ownerId} AND from_id = ${req.query.userId}`);
    res.send(result)
  })
})
 
// get all contacts, uniqlize it for dialog tabs
app.get('/messages/contacts', function (req, res) {
  console.log(req.query.ownerId); 
  db.query(`(SELECT sent, from_id, 
    (SELECT unread_counter FROM primary_messages WHERE to_id = ${req.query.ownerId} AND from_id = to_id ORDER BY sent DESC LIMIT 1) as unread_counter,
    to_id as contragent_id, conversation, name FROM primary_messages 
    JOIN users ON users.id = to_id WHERE from_id = ${req.query.ownerId}

    UNION ALL 

    SELECT sent, from_id as contragent_id, unread_counter, to_id, conversation, name FROM primary_messages 
    JOIN users ON users.id = from_id WHERE to_id = ${req.query.ownerId})
    ORDER BY sent DESC`, function (err, results) {
      
    if (err) res.send(err);
      if (results.length != 0) {
        let cont = [];
        results.forEach(el => {
            cont.push({...el})
        })
        cont = cont.filter((el, i, arr) => {
            return el === arr.find(elem => elem.conversation === el.conversation)              
    })
res.send(cont) 
  }
    else res.send(`Empty array`);
  })
})

// Send primary message; If new conversation - create new conv if conv already exist - use it
app.post('/messages/post', function (req, res) {
  let from = req.body.from_id;
  let to = req.body.to_id;
  let message = req.body.message;


  let timeStamp = new Date().getTime();
  let conversation;
  db.query(`SELECT * FROM primary_messages WHERE (from_id = ${from} AND to_id = ${to}) OR (from_id = ${to} AND to_id = ${from});`, (err, results) => {

    if (err) res.send(`ERROR! 1 >> ${err}`)
    else if (results.length != 0) {
      console.log(1, results[0].conversation, from, to);
      conversation = results[0].conversation;
      db.query(`INSERT INTO primary_messages VALUES ('${message}', ${from}, ${to}, '${timeStamp}', NULL, ${conversation}, 0)`, (err, results) => {
        db.query(`UPDATE primary_messages SET unread_counter = unread_counter + 1 WHERE to_id = ${from} AND from_id = ${to};`) 
        if (err) res.send(`ERROR! 2 >> ${err}`);
        else res.send('Message sent!');
      })
    }  
    else {
      console.log(2);
      db.query(`SELECT conversation FROM primary_messages ORDER BY conversation DESC LIMIT 1`, (error, result) => {
        console.log(result);
        let newConv = result.length == 0 ? 1 : result[0].conversation + 1;
        db.query(`INSERT INTO primary_messages VALUES ('${message}', ${from}, ${to}, '${timeStamp}', NULL, ${newConv}, 0)`, (err, results) => {
          if (err) res.send(`ERROR! 3 >> ${err}`);
          // db.query(`UPDATE primary_messages SET unread_counter = unread_counter + 1 WHERE conversation = ${newConv};`)
          res.send('Message sent!')
        })
      })

    }
  })
})

app.post('/follow', function (req, res) {

  let userId = req.body.userId;
  let followId = req.body.followId;


  db.query(`INSERT INTO users_followers (userId, followId) SELECT * FROM (SELECT '${userId}', '${followId}') AS tmp WHERE NOT EXISTS (SELECT userId FROM users_followers WHERE userId = '${userId}' AND followId = '${followId}') LIMIT 1;`, [userId, followId], function (error, results, fields) {
    if (error) {
      res.status(400)
    }
    else {
      res.status(200)
    }
  })

})
// DELETE user from friends

app.post('/unfollow', function (req, res) {



  let userId = req.body.userId;
  let followId = req.body.followId;


  db.query(`DELETE FROM users_followers WHERE userId = ? AND followId = ?`, [userId, followId], function (error, results, fields) {
    if (error) {
      res.status(400)
    }
    else {
      res.status(200)
    }
  })

})

//rest api to create a new customer record into mysql database
app.post('/users/register', function (req, res) {


  let data = req.body;
  let login = req.body.login;
  let password = passwordHash.generate(req.body.password);
  let email = req.body.email;
  if (data.info) data.info = JSON.stringify(data.info);

  db.query('INSERT INTO users (email, login, password) VALUES (?,?,?)', [email, login, password], function (error, results, fields) {

    if (error) res.json({ error: error })
    else res.status(201).json({
      message: 'User registered successfully'
    })
  });
  // console.log(res); // INSERT INTO posts SET `id` = 1, `title` = 'Hello MySQL'

  // Update user wallPage content
});
app.post('/updatepost', function (req, res) {

  if (req.body.type == 'updateLikes') {
    db.query('UPDATE users_wall_posts SET likes = ? WHERE id = ?', [JSON.stringify(req.body.likes), req.body.postId], function (error, results, fileds) {
      if (error) res.send(`Error ${error}`)
      else res.status(201).json({
        message: 'like updated'
      })
    })
  }

  if (req.body.type === 'deletePost') {
    db.query('DELETE FROM users_wall_posts WHERE id = ?', [req.body.postId], function (error, results, fileds) {
      if (error) res.send(`Error ${error}`)
      else res.status(201).json({
        message: 'post deleted'
      })
    })
  }

  if (req.body.type === 'editPost') {
    db.query('UPDATE users_wall_posts SET message = ? WHERE id = ?', [req.body.message, req.body.postId], function (error, results, fileds) {
      if (error) res.send(`Error ${error}`)
      else res.status(201).json({
        message: 'post updated'
      })
    })
  }

})

// User Log In 
app.post('/auth/login', function (req, res) {
  db.query(`select * from users where login=?`, req.body.login, function (error, results, fields) {

    if (results.length && passwordHash.verify(`${req.body.password}`, results[0].password)) {

      let token = jwt.sign({
        id: results[0].id,
        email: results[0].email
      }, 'some-secret-key', { expiresIn: 1200 })
      res.status(200).json({
        token: `Bearer ${token}`,
        userInfo: { id: results[0].id, name: results[0].name, email: results[0].email, info: results[0].info, status: results[0].status, photo: results[0].photo, profilePic: results[0].profile_background }
      })
    }
    else {
      res.status(400).send('Wrong auth data');
    }
  })

})



// get users friends

// Is current user authorized

app.post('/auth/me', passport.authenticate('jwt', { session: false, failureMessage: true }), function (req, res) {


  // if (error) res.status(401).send(error);
  // else res.status(200).send('authorized')
  db.query(`select * from users where id=?`, req.body.id, function (error, results, fields) {
    if (error) res.send(`error >>> ${error}`)
    else {

      res.status(200).json({
        userInfo: { id: results[0].id, name: results[0].name, email: results[0].email, info: results[0].info, photo: results[0].photo, status: results[0].status, profilePic: results[0].profile_background },
        // userFriends: results.map(el=> el.followId)
      })
    }
  })
})
//rest api to update record into mysql database
app.put('/users', function (req, res) {
  db.query('UPDATE `users` SET `name`=?,`email`=?,`info`=?', [req.body.name, req.body.email, req.body.info], function (error, results, fields) {
    if (error) res.send(error)
    else res.send(results)
  });
});

//rest api to delete record from mysql database
app.delete('/users/:id', function (req, res) {
  db.query('DELETE FROM `users` WHERE `id`=?', req.params.id, function (error, results, fields) {
    if (error) res.send(error)
    else res.json({ message: 'Record has been deleted!' });
  });
});


app.get('/pm', function (req, res) {
  db.query('SELECT message FROM primary_messages WHERE from_id = ? AND to_id = ? ORDER BY sent DESC;', [req.query.from, req.query.to], function (error, results, fields) {

  })
})