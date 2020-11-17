// Built-in Node.js modules
let fs = require('fs');
let path = require('path');

// NPM modules
let express = require('express');
let sqlite3 = require('sqlite3');

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

let stateListSql = 'SELECT state_abbreviation FROM States';
let stateArr = [];
Promise.all([dbQueryPromise(stateListSql)]).then((results) => {
    for(i = 0; i < results[0].length; i++) {
        stateArr.push(results[0][i].state_abbreviation);
    }
});

// promise function that reads a file and resolves the string html template
function readFilePromise(filename) {
    return new Promise ((resolve, reject) => {
        fs.readFile(filename, 'utf8', (err, template) => {
            if(err){
                reject(err);
            }
            else{
                resolve(template);
            }
        });
    });
}

// promise function that sends a query to the database and resolves the array of rows returned
function dbQueryPromise(sql) {
    return new Promise ((resolve, reject) => {
        db.all(sql, (err, rows) => {
            if(err){
                reject(err);
            }
            else{
                resolve(rows);
            }
        });
    });
}


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

// string concatenation function that adds the row to the html
function addNewRowForState(row) {
    let result = '';

    let total = row.coal + row.natural_gas + row.nuclear + row.petroleum + row.renewable;

    result = result + '<tr>';
    result = result + '<td>' + row.year + "</td>";
    result = result + '<td>' + row.coal + "</td>";
    result = result + '<td>' + row.natural_gas + "</td>";
    result = result + '<td>' + row.nuclear + "</td>";
    result = result + '<td>' + row.petroleum + "</td>";
    result = result + '<td>' + row.renewable + "</td>";
    result = result + '<td>' + total + "</td>";
    result = result + '</tr>';

    return result;
}

// GET request handler for '/state/*'
app.get('/state/:selected_state', (req, res) => {
    console.log(stateArr);
    let stateNameQuery = 'SELECT state_name FROM States WHERE state_abbreviation=\'' + req.params.selected_state + '\'';
    let stateDataQuery = 'SELECT * FROM Consumption WHERE state_abbreviation=\'' + req.params.selected_state + '\'';

    Promise.all([readFilePromise(path.join(template_dir, 'state.html')), dbQueryPromise(stateNameQuery), dbQueryPromise(stateDataQuery)]).then((results) => {
        // set promise resolves to the appropriate variables
        let template = results[0];
        let stateNameRows = results[1];
        let stateDataRows = results[2];

        let stateName = stateNameRows[0].state_name;

        // Find the previous and next states alphabetically
        let stateIndex = stateArr.indexOf(req.params.selected_state);
        let previousState;
        let nextState;
        if (stateIndex == 0) {
            previousState = stateArr[stateArr.length - 1];
            nextState = stateArr[stateIndex + 1];
        }
        else if (stateIndex == stateArr.length - 1) {
            previousState = stateArr[stateIndex - 1];
            nextState = stateArr[0];
        }
        else {
            previousState = stateArr[stateIndex - 1];
            nextState = stateArr[stateIndex + 1];
        }

        previousState = '/state/' + previousState;
        nextState = '/state/' + nextState;

        let coal_counts = [];
        let natural_gas_counts =[];
        let nuclear_counts = [];
        let petroleum_counts = [];
        let renewable_counts = [];

        let dataTable = '';

        for(i = 0; i < stateDataRows.length; i++) {
            // adds row of data to the final string
            dataTable = dataTable + addNewRowForState(stateDataRows[i]);

            // adds to the array variables
            coal_counts.push(stateDataRows[i].coal);
            natural_gas_counts.push(stateDataRows[i].natural_gas);
            nuclear_counts.push(stateDataRows[i].nuclear);
            petroleum_counts.push(stateDataRows[i].petroleum);
            renewable_counts.push(stateDataRows[i].renewable);
        }

        // dynamically set the state name and the table to show the specified data
        template = template.replace('STATE', stateName);
        template = template.replace('DATA', dataTable);

        // set the javascript variables in state.html
        template = template.replace('var state', 'var state = "' + stateName + '"');
        template = template.replace('var coal_counts', 'var coal_counts = [' + coal_counts + ']');
        template = template.replace('var natural_gas_counts', 'var natural_gas_counts = [' + natural_gas_counts + ']');
        template = template.replace('var nuclear_counts', 'var nuclear_counts = [' + nuclear_counts + ']');
        template = template.replace('var petroleum_counts', 'var petroleum_counts = [' + petroleum_counts + ']');
        template = template.replace('var renewable_counts', 'var renewable_counts = [' + renewable_counts + ']');

        // set the previous and next links
        template = template.replace('previousLink', previousState);
        template = template.replace('nextLink', nextState);

        // send final edited template to browser
        res.status(200).send(template);
    });
});

// GET request handler for '/energy/*'
app.get('/energy/:selected_energy_source', (req, res) => {
    console.log(req.params.selected_energy_source);
    fs.readFile(path.join(template_dir, 'energy.html'), (err, template) => {
        // modify `template` and send response
        // this will require a query to the SQL database

        res.status(200).type('html').send(template); // <-- you may need to change this
    });
});

app.listen(port, () => {
    console.log('Now listening on port ' + port);
});
