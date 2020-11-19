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

let stateListSql = 'SELECT * FROM States ORDER BY state_name ASC';
let stateArr = [];
Promise.all([dbQuery(stateListSql)]).then((results) => {
    for(i = 0; i < results[0].length; i++) {
        stateArr.push(results[0][i].state_abbreviation);
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
    fs.readFile(path.join(template_dir, 'year.html'), 'utf-8', (err, template) => {
        if (err) {
            res.status(404).type('plain');
            res.write('cannot read year.html');
            res.end();
        }
        else{
            //let data=[];
            var string="";
            db.all('SELECT * From Consumption WHERE Year=' +req.params.selected_year,[], (err,rows) => {
                if (err) {
                    res.status(404).type('plain');
                    res.write('cannot read from database');
                    res.end();
                }
                rows.forEach((row) => {
                    var state=row.state_abbreviation;
                    var coal_count=row.coal;
                    var natural_gas_count=row.natural_gas;
                    var nuclear_count=row.nuclear;
                    var petroleum_count=row.petroleum;
                    var renewable_count=row.renewable;
                    var total= coal_count+natural_gas_count+nuclear_count+petroleum_count+renewable_count;
                    //data.push({year: year, coal_count: coal_count, natural_gas_count: natural_gas_count, nuclear_count: nuclear_count, petroleum_count: petroleum_count, renewable_count: renewable_count, total: total});
                    string=string+'<tr> <td>'+state+'</td>'+'<td>'+coal_count+'</td>'+'<td>'+natural_gas_count+'</td>'+'<td>'+nuclear_count+'</td>'+'<td>'+petroleum_count+'</td>'+'<td>'+renewable_count+'</td>'+'<td>'+total+'</td> </tr>';
                });
                res.write(template.replace('{data}',string));
                res.end();
            });
        }
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
                reject(err);
            }else{
                resolve(rows);
            }
        });
    });
}

function makeTableRowState(row) {
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
    Promise.all([getTemplate("state.html"),
                dbQuery("SELECT * FROM Consumption WHERE state_abbreviation = \'" + req.params.selected_state + "\'"),
                dbQuery("SELECT state_name FROM States WHERE state_abbreviation = \'" + req.params.selected_state + "\'")]).then((results) =>{
        if(results[2].length == 0){
           //query empty
           res.status(404).type(".txt").send("State does not exist in the database"); 
        }else{
        //all promises resolved
        let table = "";
        let template = results[0];
        let consumptionRows = results[1];
        let stateName = results[2][0].state_name;
        for(i = 0; i < consumptionRows.length; i++) {
            table += makeTableRowState(consumptionRows[i]);
        }

        template = template.replace("{STATE}",stateName);
        template = template.replace("{DATA}", table);
        template = template.replace("{STATEIMG}", "/images/" + stateName.toLowerCase() + ".png");
        template = template.replace("{STATEALT}", "img of " + stateName);


        //find next and prev
        let prev = (stateArr.indexOf(req.params.selected_state) - 1);
        if (prev < 0){
            prev = stateArr.length-1;
        }
        let next = stateArr[(stateArr.indexOf(req.params.selected_state) + 1) % stateArr.length];
        template = template.replace("{PREV}", stateArr[prev]);
        template = template.replace("{NEXT}", next);
        res.status(200).type(".html").send(template);
        }
    }).catch((err) => {
        res.status(404).type(".txt").send("State does not exist in the database"); 
    });
        // modify `template` and send response
        // this will require a query to the SQL database
});

// GET request handler for '/energy/*'
app.get('/energy/:selected_energy_source', (req, res) => {
    console.log(req.params.selected_energy_source);
    fs.readFile(path.join(template_dir, 'energy.html'), 'utf-8',(err, template) => {
        if (err) {
            res.status(404).type('plain');
            res.write('cannot read energy.html');
            res.end();
        }
        else{
            var string="<thead><tr><th>Year</th>";
            db.all('SELECT DISTINCT state_abbreviation From Consumption' ,[], (err,rows) => {
                if (err) {
                    res.status(404).type('plain');
                    res.write('cannot read from database');
                    res.end();
                }else{
                    rows.forEach((row) => {
                        var state=row.state_abbreviation;
    
                        string=string+"<th>"+state+"</th>";
                    });
                    string=string+"<th>Total<th></tr></thead><tbody>";                }
                });
            db.all('SELECT * From Consumption ORDER BY year' ,[], (err,rows) => {
                if (err) {
                    res.status(404).type('plain');
                    res.write('cannot read from database');
                    res.end();
                }else{
                    count=0;
                    total=0;
                    rows.forEach((row) => {
                        count=count+1;
                        var energy=0;
                        if(req.params.selected_energy_source=="coal"){energy=row.coal;}
                        else if(req.params.selected_energy_source=="natural_gas"){energy=row.natural_gas;}
                        else if(req.params.selected_energy_source=="nuclear"){energy=row.nuclear;}
                        else if(req.params.selected_energy_source=="petroleum"){energy=row.petroleum;}
                        else if(req.params.selected_energy_source=="renewable"){energy=row.renewable;}
                        else{
                            res.status(404).type(".txt").send(req.params.selected_energy_source + "does not exist in the database"); 
                        }

                        if(count==1){
                            total=total+energy;
                            string=string+"<tr><td>"+row.year+"</td>";
                            string=string+"<td>"+energy+"</td>";
                        }
                        if(count==51){
                            total=total+energy;
                            string=string+"<td>"+energy+"</td>";
                            string=string+"<td>"+total+"</td>"
                            string=string+"</tr>";
                            total=0;
                            count=0;
                        }
                        if(count!==1 && count!==0){
                            total=total+energy;
                            string=string+"<td>"+energy+"</td>";
                        }
                    });
                    string=string+"</tbody><table>";
                    //console.log(string);
                    template = template.replace("{ENERGYIMG}", "/images/" + req.params.selected_energy_source.toLowerCase() + ".png");
                    template = template.replace("{ENERGYALT}", "image of " + req.params.selected_energy_source.toLowerCase());
                    res.write(template.replace('{data}',string));
                    res.end();
                }
            });
        }
    });
});





app.listen(port, () => {
    console.log('Now listening on port ' + port);
});
