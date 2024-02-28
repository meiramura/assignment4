const express = require('express');
const session = require('express-session');
const bodyParser = require('body-parser');
const mongoose = require('mongoose');
const axios = require('axios');
const path = require('path');
const ejs = require('ejs');
const request = require('request');
const bcrypt = require('bcryptjs');
const saltRounds = 10; 
const app = express();
const cors = require('cors');
const port = process.env.PORT || 3000;


app.use(cors());
app.use(session({
    secret: 'your-secret-key',
    resave: false,
    saveUninitialized: true
}));

app.use(bodyParser.json());

mongoose.connect('mongodb+srv://meirambek:Pa$$529@cluster1.eexs8ak.mongodb.net/')
const db = mongoose.connection;

db.on('error', console.error.bind(console, 'MongoDB connection error:'));
db.once('open', () => {
    console.log('Connected to MongoDB');
});

const userSchema = new mongoose.Schema({
    username: String,
    password: String,
    creationDate: { type: Date, default: Date.now },
    updateDate: Date,
    deletionDate: Date,
    isAdmin: { type: Boolean, default: false }
});

const User = mongoose.model('User', userSchema);

const historySchema = new mongoose.Schema({
    user_id: String,
    request_path: String,
    request_method: String,
    request_data: Object,
    response_status: Number,
    response_data: Object,
    timestamp: { type: Date, default: Date.now }
});

const HistoryModel = mongoose.model('History', historySchema);

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'public'));
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

const captureHistory = async (req, res, next) => {
    try {
        const userId = req.session.userId;

        await HistoryModel.create({
            user_id: userId,
            request_path: req.path,
            request_method: req.method,
            request_data: req.body, 
            response_status: res.statusCode,
            response_data: res.locals.responseData,
        });
        next();
    } catch (error) {
        console.error('Error capturing history:', error);
        res.status(500).send('Internal Server Error');
    }
};

app.get('/news', async (req, res) => {
    const apiKey = '2f6272a347d54537974d3fd6de9c71f4'; 
    const topic = req.query.topic || 'clothing fashion'; 

    const options = {
        method: 'GET',
        url: 'https://newsapi.org/v2/everything',
        params: {
            q: topic,
            apiKey: apiKey
        }
    };

    try {
        const response = await axios.request(options);
        const newsData = response.data;

        res.render('news', { newsData, topic });
    } catch (error) {
        console.error('Error fetching news:', error);
        res.status(500).send('Internal Server Error');
    }
});


app.get('/', (req, res) => {
    res.render('register', { errorMessage: undefined });
});


app.post('/register', async (req, res) => {
    const { username, password, isAdmin } = req.body;

    try {
        const existingUser = await User.findOne({ username });
        if (existingUser) {
            return res.render('register', { errorMessage: 'Username already exists' });
        }

        const hashedPassword = await hashPassword(password);

        const newUser = await User.create({
            username,
            password: hashedPassword,
            isAdmin: isAdmin === 'on', 
        });

        res.redirect('/login');
    } catch (error) {
        console.error('Error during registration:', error);
        res.status(500).send('Internal Server Error');
    }
});

const itemSchema = new mongoose.Schema({
    title: String,
    price: String,
    image: String,
});

const Item = mongoose.model('Item', itemSchema);
app.get('/admin/create',  (req, res) => {

    res.render('createItem');
});
app.post('/admin/create', async (req, res) => {
    const newItem = new Item({
        title: req.body.title,
        price: req.body.price,
        image: req.body.image,
    });

    try {
        await newItem.save();
        res.redirect('/admin');
    } catch (error) {
        console.log(error);
        res.status(500).send('Internal Server Error');
    }
});
const authenticateAdmin = (req, res, next) => {
    if (!req.session.userId) {
        res.redirect('/login');
    } else {
        next();
    }
};

app.post('/create-admin', async (req, res) => {
    const { username, password } = req.body;

    try {
        const existingAdmin = await User.findOne({ isAdmin: true });
        if (existingAdmin) {
            return res.render('admin-create', { errorMessage: 'Admin user already exists' });
        }

        const hashedPassword = await hashPassword(password);

        const newAdmin = await User.create({
            username,
            password: hashedPassword,
            isAdmin: true,
        });

        res.redirect('/login');
    } catch (error) {
        console.error('Error creating admin user:', error);
        res.status(500).send('Internal Server Error');
    }
});

app.get('/admin', authenticateAdmin, async (req, res) => {
    try {
        const users = await User.find();
        const items = await Item.find();
        res.render('admin', { users, items });
    } catch (error) {
        console.error('Error fetching data:', error);
        res.status(500).send('Internal Server Error');
    }
});


app.post('/admin/adduser', async (req, res) => {
    const { newUsername, newPassword, isAdmin } = req.body;

    try {
        const newUser = await User.create({
            username: newUsername,
            password: newPassword,
            isAdmin: isAdmin === 'on', 
        });

        res.redirect('/admin');
    } catch (error) {
        console.error('Error adding user:', error);
        res.status(500).send('Internal Server Error');
    }
});
app.get('/admin/edit/:_id', async (req, res) => {
    const _id = req.params._id;

    try {
        const user = await User.findById(_id);
        res.render('edit', { user });
    } catch (error) {
        console.error('Error rendering edit form:', error);
        res.status(500).send('Internal Server Error');
    }
});
app.post('/admin/edit/:_id', async (req, res) => {
    const { username, password, isAdmin } = req.body;
    const _id = req.params._id;

    try {
        await User.findByIdAndUpdate(_id, {
            username,
            password,
            isAdmin: isAdmin === 'on',
            updateDate: Date.now()
        });

        res.redirect('/admin');
    } catch (error) {
        console.error('Error editing user:', error);
        res.status(500).send('Internal Server Error');
    }
});

app.post('/admin/delete/:_id', async (req, res) => {
    const _id = req.params._id;

    try {
        await User.findByIdAndDelete(_id);
        res.redirect('/admin');
    } catch (error) {
        console.error('Error deleting user:', error);
        res.status(500).send('Internal Server Error');
    }
});
app.get('/admin/edit-item/:_id', async (req, res) => {
    const _id = req.params._id;

    try {
        const foundItem = await Item.findById(_id);
        res.render('edit', { item: foundItem });
    } catch (error) {
        console.error('Error rendering edit item form:', error);
        res.status(500).send('Internal Server Error');
    }
});

app.post('/admin/edit-item/:_id', async (req, res) => {
    const _id = req.params._id;

    try {
        await Item.findByIdAndUpdate(_id, {
            title: req.body.title,
            price: req.body.price,
            image: req.body.image,
        });
        res.redirect('/admin');
    } catch (error) {
        console.error('Error editing item:', error);
        res.status(500).send('Internal Server Error');
    }
});

app.post('/admin/delete-item/:_id', async (req, res) => {
    const _id = req.params._id;

    try {
        await Item.findByIdAndDelete(_id);
        res.redirect('/admin');
    } catch (error) {
        console.error('Error deleting item:', error);
        res.status(500).send('Internal Server Error');
    }
});

const authenticateUser = (req, res, next) => {
    if (!req.session.userId) {
        res.redirect('/login');
    } else {
        next();
    }
};

app.get('/logout', (req, res) => {
    req.session.destroy((err) => {
        if (err) {
            console.error('Error during logout:', err);
            res.status(500).send('Internal Server Error');
        } else {
            res.redirect('/login');
        }
    });
});
app.get('/login', (req, res) => {
    res.render('login', { errorMessage: undefined });
});

app.post('/login', async (req, res) => {
    const { username, password } = req.body;
    try {
        const user = await User.findOne({ username });
        if (user && user.password === password) {
            if (user.isAdmin === true) {
                return res.redirect('/admin');
            }
        }

        if (user) {
            const isPasswordValid = await verifyPassword(password, user.password);

            if (isPasswordValid) {
                if (user.isAdmin === true) {
                    req.session.userId = user._id;
                    req.session.isAdmin = true;  
                    req.session.username = user.username;
                    return res.redirect('/admin');
                }

                req.session.userId = user._id;
                req.session.isAdmin = false; 
                req.session.username = user.username;
                return res.redirect('/main');
            }
        }

        return res.render('login', { errorMessage: 'Invalid credentials' });
    } catch (error) {
        console.error('Error during login:', error);
        return res.status(500).send('Internal Server Error');
    }
});



app.get('/main', authenticateUser, async (req, res) => {
    try {
        const items = await Item.find();
        const username = req.session.username;
        res.render('mainPage', { username, items });
    } catch (error) {
        console.error('Error fetching items:', error);
        res.status(500).send('Internal Server Error');
    }
})
const cartItemSchema = new mongoose.Schema({
    userId: String,
    username:String,
    itemDetails: {
        title: String,
        price: String,
        image: String,
        quantity: Number,
    },
});

const CartItem = mongoose.model('CartItem', cartItemSchema);
const hashPassword = async (plainPassword) => {
    try {
        const salt = await bcrypt.genSalt(saltRounds);
        const hashedPassword = await bcrypt.hash(plainPassword, salt);
        return hashedPassword;
    } catch (error) {
        throw error;
    }
};
app.post('/checkout', async (req, res) => {
    const userId = req.session.userId;
    const username = req.session.username

    if (!userId) {
        return res.status(401).json({ success: false, error: 'User not authenticated' });
    }

    const { items } = req.body;

    console.log('Received Checkout Request:', { userId, items });

    try {
        const cartItems = items.map(item => ({
            userId,
            username,
            itemDetails: item,
        }));

        const result = await CartItem.insertMany(cartItems);

        res.status(201).json({ success: true, result });
    } catch (error) {
        console.error('Error during checkout:', error);
        res.status(500).json({ success: false, error: 'Internal Server Error' });
    }
});

const verifyPassword = async (plainPassword, hashedPassword) => {
    try {
        const match = await bcrypt.compare(plainPassword, hashedPassword);
        return match;
    } catch (error) {
        throw error;
    }
};


app.use(captureHistory);

app.listen(port, "0.0.0.0", () => {
    console.log(`Server is running on http://localhost:${port}`);
});