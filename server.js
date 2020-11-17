// Built-in Node.js modules
let fs = require('fs');
let path = require('path');

// NPM modules
let express = require('express');
let sqlite3 = require('sqlite3');
const { resolve } = require('path');
const { rejects } = require('assert');
const { get } = require('https');


let public_dir = path.join(__dirname, 'public');
let template_dir = path.join(__dirname, 'templates');
let db_filename = path.join(__dirname, 'db', 'usenergy.sqlite3');

let app = express();
let port = 8000;
// open usenergy.sqlite3 database
let db = new sqlite3.Database(db_filename, sqlite3.OPEN_READONLY, (err) => {
    if (err) {
        console.log('Error opening ' + db_filename);
    }
    else {
        console.log('Now connected to ' + db_filename);
    }
});

app.use(express.static(public_dir)); // serve static files from 'public' directory


// GET request handler for home page '/' (redirect to /year/2018)
app.get('/', (req, res) => {
    res.redirect('/year/2018');
});

// GET request handler for '/year/*'
app.get('/year/:selected_year', (req, res) => {
    console.log(req.params.selected_year);
    fs.readFile(path.join(template_dir, 'year.html'), (err, template) => {
        // modify `template` and send response
        // this will require a query to the SQL database

        res.status(200).type('html').send(template); // <-- you may need to change this
    });
});

function getTemplate(fileName){
    return new Promise((resolve,reject) =>{
        let template = fs.readFile(path.join(template_dir, fileName),"utf-8", (err, template) => {
            resolve(template);
        });
    });
}

function dbQuery(sqlStatment){
    return new Promise((resolve, reject) => {
        db.all(sqlStatment, [],(err, rows) => {
            if(err){
                reject();
            }else{
                resolve(rows);
            }
        });
    });
}

function addNewRowForState(row) {
    let result = '';

    let total = row.coal + row.natural_gas + row.nuclear + row.petroleum + row.renewable;

    result += '<tr>';
    result += '<td>' + row.year + "</td>";
    result += '<td>' + row.coal + "</td>";
    result += '<td>' + row.natural_gas + "</td>";
    result += '<td>' + row.nuclear + "</td>";
    result += '<td>' + row.petroleum + "</td>";
    result += '<td>' + row.renewable + "</td>";
    result += '<td>' + total + "</td>";
    result += '</tr>';

    return result;
}
// GET request handler for '/state/*'
app.get('/state/:selected_state', (req, res) => {
    console.log(req.params.selected_state);
    Promise.all([getTemplate("state.html"),dbQuery("SELECT year, coal, natural_gas, nuclear, petroleum, renewable FROM Consumption WHERE state_abbreviation = \'" + req.params.selected_state + "\'")]).then((results) =>{
        //all promises resolved
        let table = "";
        let template = results[0];
        let consumptionRows = results[1];
        for(i = 0; i < consumptionRows.length; i++) {
            table += addNewRowForState(consumptionRows[i]);
        }
        res.write(template.replace("{DATA}", table));
        res.end();
    });
        // modify `template` and send response
        // this will require a query to the SQL database

});

// GET request handler for '/energy/*'
app.get('/energy/:selected_energy_source', (req, res) => {
    console.log(req.params.selected_energy_source);
    Promise.all([getTemplate("energy.html"),dbQuery("SELECT year, state_abbreviation FROM Consumption WHERE = \'" + req.params.selected_state + "\'")]).then((results) =>{
        //all promises resolved
        let table = "";
        let template = results[0];
        let consumptionRows = results[1];
        for(i = 0; i < consumptionRows.length; i++) {
            table += addNewRowForState(consumptionRows[i]);
        }
        res.write(template.replace("{DATA}", table));
        res.end();
    });
});

app.listen(port, () => {
    console.log('Now listening on port ' + port);
});
