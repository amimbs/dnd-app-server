const express = require('express');
const app = express();
const cors = require('cors');
// We do this because the front end runs on 3000
const PORT = process.env.PORT || 3001;
// heroku gives a port that the app runs on so we set it equal to the environments process to ensure it deploys correctly

const models = require('./models');
const user = require('./models/user')
const bcyrpt = require('bcrypt');
const saltRounds = 10;
const { response } = require('express');
const bodyParser = require('body-parser');
const cookieParser = require('cookie-parser');
const session = require('express-session');
const jwt = require('jsonwebtoken');
require ('dotenv').config();
const seshSecret = process.env.SESSION_SECRET;
const tokenSecret = process.env.JWT_SECRET;

// in package.json change the main to the server and add the nodemon script
app.use(express.json());
app.use(
    cors({
        origin: ["http://localhost:3000"],
        methods: ["GET", "POST"],
        credentials: true
    })
);

app.use(cookieParser());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(session(
    {
        key: "userId",
        secret: seshSecret,
        resave: false,
        saveUninitialized: false,
        cookie: {
            expires: 60 * 60 * 24,
        },
    })
);

// verify jwt middelware
const verifyJWT = (req, res, next) => {
    const token = req.headers["x-access-toen"]
    
    if(!token) {
        res.status(400).send("no token bro, wtf");
        return;
    } else {
        jwt.verify(token, tokenSecret, (err, decoded) => {
            if (err) {
                res.status(400).json({auth: false, message: "not authorized"});
                return;
            } else {
                req.userId = decoded.id;
                next();
            }
        })
    };
};

app.post('/register', (req, res) => {
    const { firstName, lastName, email, username, password } = req.body;
    if (!email || !password || !firstName || !lastName || !username) {
        return res.status(400).json({ error: 'All fields are required' });
    };

    bcyrpt.hash(password, saltRounds, (err, hash) => {
        models.User.create({
            firstName: firstName,
            lastName: lastName,
            email: email,
            username: username,
            password: hash
        }).then((user) => {
            return res.status(200).json({ success: true, user_id: user.id });
        }).catch(e => {
            let errors = [];
            e.errors.forEach(error => {
                errors.push(error.message);
            });
            return res.status(400).json({ error: errors });
        });
    });
});

app.get('/login', (req, res) => {
    if (req.session.user) {
        res.send({ loggedIn: true, user: req.session.user })
    } else {
        res.send({ loggedIn: false });
    };
});

app.get('/isUserAuth', verifyJWT, (req, res) => {
    res.status(200).send("yo, you're auth'd")
})

app.post('/login', async (req, res) => {
    const { username, password } = req.body;
    const foundUser = await models.User.findOne({ where: { username: username }, raw: true });
    if (!foundUser) {
        return res.status(400).json({ error: 'invalid username' });
    };
    bcyrpt.compare(password, foundUser.password, (err, match) => {
        if (match) {
            //not sure if I implemented this correctly

            const id = foundUser.id;
            const token = jwt.sign({id}, tokenSecret, {
                //this is 5 mins
                expiresIn: 300,
            });

            req.session.user = foundUser;
            let responseUser = {
                username: foundUser.username,
                firstName: foundUser.firstName,
                email: foundUser.email,
                id: foundUser.id
            };

            res.status(200).json({auth: true, token: token, foundUser: responseUser})
            // console.log('this is the session: ' + req.session.user)
            // res.status(200).json({ success: true, user_id: foundUser.id });
            // console.log(foundUser)
        } else {
            res.status(400).json({ error: 'Invalid password combination' });
        };
    });
});

app.listen(PORT, () => {
    console.log(`app started on ${PORT}`);
});