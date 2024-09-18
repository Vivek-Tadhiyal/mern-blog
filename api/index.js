const express = require("express");
const app = express();
const cors = require ("cors");
const User = require('./models/User')
const Post = require('./models/Post')
const { mongoose } = require("mongoose");
const bcrypt = require('bcryptjs');
const jwt = require("jsonwebtoken")
const cookieParser = require('cookie-parser');
const multer = require('multer');
const uploadMiddleware = multer({ dest: 'uploads/' })
const fs = require('fs');

const salt = bcrypt.genSaltSync(10);
const secret = 'asfdfewer13434';

app.use((cors({credentials:true, origin:'http://localhost:5173'})));
app.use(express.json());
app.use(cookieParser());
app.use('/uploads', express.static(__dirname + '/uploads'));

const dotenv = require('dotenv');
dotenv.config();

mongoose.connect(process.env.MONGO_URL);

app.post('/register', async (req, res)=>{
    const {username, password} = req.body;
    try{
        const userDoc = await User.create({username,
             password: bcrypt.hashSync(password,salt),
            });
            
        res.json(userDoc);
    } catch(e){
        res.status(400).json(e);
    }

});

app.post("/login", async (req, res) => {
    const {username, password} = req.body;
    const userDoc = await User.findOne({username});

    if (!userDoc) {
        return res.status(400).json('Wrong Credentials');
    }

    const passOk = bcrypt.compareSync(password, userDoc.password);
    if(passOk){
        //logged in
        jwt.sign({username, id:userDoc._id}, secret, {}, (err, token) => {
            if(err) throw err;
            res.cookie('token', token).json({ //setting token in the cookie
                id: userDoc._id,
                username,
            });
        });

    } else {
        res.status(400).json('Wrong Credentials');
    }
});

app.get('/profile', (req,res)=> {
    const {token} = req.cookies;
    jwt.verify(token, secret, {}, (err, info) => {
        if(err) throw err;
        res.json(info);
    });
});

app.post('/logout', (req,res) => {
    res.cookie('token', '').json('ok'); //resetting token to empty string
})

app.post('/post', uploadMiddleware.single('file') , async(req, res) => {
    const {originalname,path} = req.file;
    const parts = originalname.split('.');
    const ext = parts[parts.length - 1];
    const newPath = path+'.'+ext;
    fs.renameSync(path, newPath);

    const {token} = req.cookies;
    jwt.verify(token, secret, {}, async (err, info) => {
        if(err) throw err;
        const {title, summary, content} = req.body;
        const postDoc = await Post.create({
        title,
        summary,
        content,
        cover: newPath,
        author: info.id,
    });
    res.json({postDoc});
    });
   
});

app.put('/post', uploadMiddleware.single('file') , async (req, res)=>{
    let newPath = null;
    if(req.file){
    const {originalname,path} = req.file;
    const parts = originalname.split('.');
    const ext = parts[parts.length - 1];
    newPath = path+'.'+ext;
    fs.renameSync(path, newPath);
    }

    const {token} = req.cookies;
    jwt.verify(token, secret, {}, async (err, info) => {
        if(err) throw err;
        const {id, title, summary, content} = req.body;
        const postDoc = await Post.findById(id);
        const isAuthor = JSON.stringify(postDoc.author) === JSON.stringify(info.id);
        if(!isAuthor) {
            return res.status(400).json('you are not the author');
        }
    
        // Use findOneAndUpdate
        const updatedPostDoc = await Post.findOneAndUpdate(
            { _id: id }, // Query condition
            {
                title,
                summary,
                content,
                cover: newPath ? newPath : postDoc.cover,
            },
            { new: true } // Return the updated document
        );

        res.json(postDoc);
    });
    
});


app.get('/post', async(req, res)=> {
    res.json(await Post.find()
    .populate('author', ['username'])
    .sort({createdAt: -1})
    .limit(20)
    );
})

app.get('/post/:id', async(req, res) => {
    const {id} = req.params;
    const postDoc =  await Post.findById(id).populate('author', ['username']);
    res.json(postDoc);
})

app.listen(4000, ()=>console.log("Listening on 4000"));
