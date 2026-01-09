const express = require("express");
const cors = require("cors");
const mongoose = require('mongoose');

//MongoDB
require("../database");

const Note = require('../schemas/note');
const System = require('../schemas/system');
const User = require('../schemas/user');
const Alter = require('../schemas/alter');
const State = require('../schemas/state');
const Group = require('../schemas/group');
const { Shift } = require('../schemas/front');
const config = require('../../config.json');

const app = express(); 
app.use(cors()); 
app.use(express.json());