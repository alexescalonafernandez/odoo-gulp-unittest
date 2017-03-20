/**
 * @author Alexander Escalona Fernández <alexescalonafernandez@gmail.com>
 */

//DEPENDENCES
var gulp = require('gulp');
var util = require('gulp-util');
var runSequence = require('run-sequence'); //run gulp taks sequentially
var browserSync = require('browser-sync').create(); //auto refresh html reports
var fs = require('fs'); //file system operations
var path = require('path'); //system path operations
var format = require('string-format');
var colors = require('colors/safe'); //add color style to string before show in shell
var inquirer = require('inquirer'); //ask for user input
var PropertiesReader = require('properties-reader'); //read property file
var pg = require('pg'); //postgres client
var through = require('through2'); //file streaming
var execSync = require('child_process').execSync; //run external process sequentially
var del = require('del'); //for deleting files/folders
var htmlparser = require("htmlparser2"); //for parsing html files
var Table = require('cli-table2'); //show data in table format in shell

//GLOBAL VARIABLES
var npmPackageJson = JSON.parse(fs.readFileSync('./package.json'));
var moduleName = path.basename(__dirname);

var moduleUpdateTestFolderName = 'module_update_tests';
var moduleUpdateTestFolder = path.join(__dirname, moduleUpdateTestFolderName);
var serverTestRunner = 'server_test_runner.py';

var testReportFolderName = 'test_report';
var testReportFolder = path.join(__dirname, testReportFolderName);
var htmlTestIndexReportFilename = 'index.html';
var htmlTestModuleUpdateProcessReportFilename = format('module_update({0}).html', moduleName);
var htmlTestModuleReportFilename = format('{0}.html', moduleName);
var moduleUnitTestConfigFilename = 'unit_test_config.json';

var htmlTestIndexReportFile = path.join(testReportFolderName, htmlTestIndexReportFilename);
var htmlTestModuleUpdateProcessReportFile = path.join(testReportFolderName, htmlTestModuleUpdateProcessReportFilename);
var htmlTestModuleReportFile = path.join(testReportFolderName, htmlTestModuleReportFilename);

var odooExeName = 'odoo.exe';

var colorPalette = [
    colors.magenta,
    colors.white,
    colors.green,
    colors.yellow,
    colors.red
];
var colorChooser = {
    'header_row': colors.magenta,
    'total_row': colors.magenta,
    'passClass': colors.green,
    'failClass': colors.yellow,
    'errorClass': colors.red,
    'passCase': colors.green,
    'failCase': colors.yellow,
    'errorCase': colors.red,
    'none': colors.green
}
var icons = {
    'passCase': '\u2714',
    'none': '\u2714',
    'failCase': '\u26A0',
    'errorCase': '\u2717'
};
var moduleSourceCodeGlobs = [
    '*.py',
    'models/**/*.py',
    'controllers/**/*.py',
    'tests/**/*.py'
];
var allSourceCodeGlobs = moduleSourceCodeGlobs.concat([
    format('{0}/**/*.py', moduleUpdateTestFolderName)
]);
var moduleCompiledSourceCodeGlobs = moduleSourceCodeGlobs.map(function(glob) {
    return format('{0}c', glob);
});
var allCompiledSourceCodeGlobs = allSourceCodeGlobs.map(function(glob) {
    return format('{0}c', glob);
});
var moduleNonSourceCodeGlobs = [
    'views/**/*',
    'security/**/*',
    'demo/**/*'
];
var buildFolder = 'dist';

var openerpServerProps = {};
var odooInstalationFolders = [];
var availableDatabaseNames = [];
var moduleUnitTestConfigData = {};

//PUBLIC GULP TASKS
gulp.task('default', function(done) {
    var taskName = this.seq[0];
    var questions = [{
        type: 'list',
        name: 'gulpTask',
        message: format('What {0} you wanna execute?', colors.blue('gulp task')),
        choices: Object.getOwnPropertyNames(this.tasks).filter(function(name) {
            return !(name == taskName || name.startsWith('_'));
        }).concat([new inquirer.Separator()])
    }];
    return inquirer.prompt(questions).then(function(answers) {
        runSequence([answers.gulpTask]);
    });
});

gulp.task('create-default-html-report-files', function(done) {
    if (!existHtmlReportFiles())
        createDefaultHtmlReportFiles();
    done();
});

gulp.task('create-module-unit-test-config-file', function(done) {
    var taskName = this.seq[0];
    var filePath = path.join(moduleUpdateTestFolder, moduleUnitTestConfigFilename);
    if (fs.existsSync(filePath)) {
        var questions = [{
            type: 'confirm',
            name: 'createFile',
            message: applyFormat(
                ['The config file {0} already exists.', '{1}'],
                colors.yellow(filePath.replace(__dirname, '.')),
                colors.blue('Do you wanna modify it?')
            ),
            default: false
        }];
        inquirer.prompt(questions).then(function(answers) {
            if (answers.createFile)
                createConfigFile();
            else done();
        });
    } else createConfigFile();

    function createConfigFile() {
        runSequence(
            ['_read-openerp-server-config'], ['_select-odoo-database'],
            function(err) {
                if (!err) {
                    var values = [htmlTestModuleUpdateProcessReportFile, htmlTestModuleReportFile];
                    ['test_module_update_process_report_file', 'test_module_report_file'].forEach(
                        function(key) {
                            setModuleUnitTestConfigPropertyValue(key, values.shift().split(path.sep).join('/'), taskName);
                        }
                    );

                    return newFile(moduleUnitTestConfigFilename, JSON.stringify(moduleUnitTestConfigData, undefined, 2))
                        .pipe(gulp.dest(moduleUpdateTestFolder))
                        .on('end', done);
                }
            });
    }
});

gulp.task('compile-all-py', function(done) {
    return gulp.src(allSourceCodeGlobs)
        .pipe(
            through.obj(function(file, encoding, done) {
                console.log(format('Compiling {0}', colors.green(file.path.replace(__dirname, '.'))));
                execSync(format('python -m py_compile {0}', file.path));
                done(null, file);
            }).resume()
        );
});

gulp.task('test', function(done) {
    runSequence(['_execute-odoo-module-testing'], ['show-test-report'], done);
});

gulp.task('show-test-report', function(done) {
    var taskName = this.seq[0];
    if (existHtmlReportFiles()) {
        var shellTable = PythonHTMLTestRunnerShellTableReport();
        console.log(colors.green('Showing test report in console mode...'));
        shellTable.show();
        done();
    } else {
        throwPluginError(taskName,
            colors.red(
                [htmlTestIndexReportFile, htmlTestModuleUpdateProcessReportFile, htmlTestModuleReportFile]
                .map(function(filePath) {
                    return fs.existsSync(filePath) ? undefined : filePath;
                }).reduce(function(acc, current) {
                    if (current == undefined)
                        return acc;
                    else return acc + format('{0} {1}', acc.endsWith(':') ? ' ' : ', ', current);
                }, 'Not found:')
            )
        );
    }
});

gulp.task('auto-py-compile', function(done) {
    console.log(colors.green('Watching project source code changes for executing python compile...'));
    return gulp.watch(
            allSourceCodeGlobs,
            function(event) {
                compilePythonOnWatchEvent(event);
            }
        )
        .on('end', done);
});

gulp.task('auto-test', function(done) {
    runSequence(['_read-module-unit-test-config-file'], function(err) {
        if (!err) {
            console.log(colors.green('Init Browser Sync for html test report...'));
            browserSync.watch(format('{0}/*.html', testReportFolderName))
                .on('change', function() {
                    console.log(colors.green('Reloading html test report file...'));
                    browserSync.reload();
                });
            browserSync.init({
                server: {
                    baseDir: format('./{0}', testReportFolderName)
                }
            }, function() {
                console.log(colors.green('Watching project source code changes for executing testing and report generation...'));
                return gulp.watch(
                        moduleSourceCodeGlobs.concat(moduleNonSourceCodeGlobs),
                        function(event) {
                            compilePythonOnWatchEvent(event);
                            gulp.start('test');
                        }
                    )
                    .on('end', done);
            });
        }
    });
});

gulp.task('clean-pyc', function(done) {
    return gulp.src(allCompiledSourceCodeGlobs, { read: false })
        .pipe(
            through.obj(function(file, encoding, done) {
                console.log(format('Deleting {0}', colors.green(file.path.replace(__dirname, '.'))));
                del(file.path);
                done(null, file);
            }).resume()
        );
});

gulp.task('clean-dist', function(done) {
    return del([buildFolder], done);
});

gulp.task('build', function(done) {
    runSequence(
        ['clean-pyc'], ['compile-all-py'], ['clean-dist'],
        function(err) {
            if (!err) {
                return gulp.src(moduleSourceCodeGlobs.concat(
                        moduleCompiledSourceCodeGlobs.concat(moduleNonSourceCodeGlobs)), { base: '.' })
                    .pipe(gulp.dest(buildFolder))
                    .pipe(
                        through.obj(function(file, encoding, done) {
                            console.log(format('Copying {0}', colors.green(file.path.replace(__dirname, '.'))));
                            done(null, file);
                        }).resume()
                    ).on('end', done);

                function generateCopyFilePath(filePath) {
                    return path.dirname(filePath).replace(__dirname, path.join(__dirname, buildFolder));
                }
            }
        });
});

gulp.task('execute-odoo-module-install', function(done) {
    executeModuleIntallOrUpdateTask(true, done);
});

gulp.task('execute-odoo-module-update', function(done) {
    executeModuleIntallOrUpdateTask(false, done);
});

gulp.task('npm-scripts', function(done) {
    var questions = [{
        type: 'list',
        name: 'script',
        message: format('What {0} you wanna execute?', colors.blue('npm script')),
        choices: npmPackageJson.scripts ? Object.getOwnPropertyNames(npmPackageJson.scripts).concat([new inquirer.Separator()]) : []
    }];
    if (questions[0].choices.length > 0) {
        return inquirer.prompt(questions).then(function(answers) {
            var command = format('npm run {0}', answers.script);
            console.log(format('Executing {0}', colors.green(command)));
            execSync(command, { stdio: 'inherit' });
        });
    } else done();
});

//PRIVATE GULP TASKS (USED LIKE SUBTASKS, DON'T CALL IT)
gulp.task('_read-module-unit-test-config-file', function(done) {
    var taskName = this.seq[0];
    var filePath = path.join(moduleUpdateTestFolder, moduleUnitTestConfigFilename);
    var flag = [checkUnitTestConfigFile, checkProperties, checkOdooExeFile]
        .reduce(function(valid, fn) {
            return valid ? fn() : false;
        }, true);

    if (flag)
        done();
    else runSequence(['create-module-unit-test-config-file'], done);

    function checkUnitTestConfigFile() {
        if (!fs.existsSync(filePath)) {
            console.log(
                applyFormat(['File {0} not exists.', 'Creating {0} file...'],
                    colors.yellow(filePath.replace(__dirname, '.')))
            );
            return false;
        }
        return true;
    }

    function checkProperties() {
        moduleUnitTestConfigData = JSON.parse(fs.readFileSync(filePath));
        var notFound = getNotFoundOwnProperties(moduleUnitTestConfigData, getModuleUnitTestConfigPropertyNames())
            .map(function(folder) {
                return colors.red(folder);
            });
        if (notFound.length > 0) {
            console.log(
                applyFormat(['File {0} not contains [ {1} ] properties.', 'Regenerating {0} file...'],
                    colors.yellow(filePath.replace(__dirname, '.')), notFound.join())
            );
            return false;
        }
        return true;
    }

    function checkOdooExeFile() {
        var odooExeFile = path.join(
            moduleUnitTestConfigData.odoo_server_folder.split('/').join(path.sep), odooExeName);

        if (!fs.existsSync(odooExeFile)) {
            console.log(
                applyFormat(['The path {0} is not a valid odoo installation folder.', 'Regenerating {1} file...'],
                    colors.red(path.dirname(odooExeFile)), colors.yellow(filePath.replace(__dirname, '.')))
            );
            return false;
        }
        return true;
    }
});

gulp.task('_read-openerp-server-config', function(done) {
    var taskName = this.seq[0];
    runSequence(['_get-odoo-instalation-folders'], function(err) {
        if (!err) {
            if (odooInstalationFolders.length == 0) {
                throwPluginError(taskName,
                    format('No exists any folder in {0} {1} which refers to a {2}.',
                        colors.red('path'), colors.green('enviroment variable'), colors.yellow('valid odoo installation folder'))
                );
            } else if (odooInstalationFolders.length == 1) {
                setOdooServerFolder(odooInstalationFolders[0]);
            } else {
                var questions = [{
                    type: 'list',
                    name: 'installationFolder',
                    message: format('What is your {0}?', colors.blue('odoo installation folder')),
                    choices: odooInstalationFolders
                }];
                return inquirer.prompt(questions).then(function(answers) {
                    setOdooServerFolder(answers.installationFolder);
                });
            }

            function setOdooServerFolder(folder) {
                setModuleUnitTestConfigPropertyValue('odoo_server_folder', folder.split(path.sep).join('/'), taskName);
                openerpServerProps = PropertiesReader(path.join(folder, 'openerp-server.conf'));
                done();
            }
        }
    });
});

gulp.task('_get-odoo-instalation-folders', function(done) {
    var hash = {};
    odooInstalationFolders =
        process.env['path'].split(path.delimiter)
        .map(function(data) {
            var folder = data.trim();
            return folder.endsWith(path.sep) ? folder.slice(0, -1) : folder;
        })
        .filter(function(item, index) {
            return hash.hasOwnProperty(item) ? false : (hash[item] = true);
        })
        .filter(function(folder) {
            return fs.existsSync(path.join(folder, odooExeName));
        });
    done();
});

gulp.task('_select-odoo-database', function(done) {
    var taskName = this.seq[0];
    runSequence(['_get-available-odoo-databases'], function(err) {
        if (!err) {
            if (availableDatabaseNames.length == 0) {
                throwPluginError(taskName,
                    format('There is not any {0} in {1}.', colors.red('odoo database'), colors.yellow('postgres'))
                );
            } else if (availableDatabaseNames.length == 1) {
                selectDatabase(availableDatabaseNames[0]);
            } else {
                var questions = [{
                    type: 'list',
                    name: 'databaseName',
                    message: format('What is your {0}?', colors.blue('odoo database')),
                    choices: availableDatabaseNames
                }];
                return inquirer.prompt(questions).then(function(answers) {
                    selectDatabase(answers.databaseName);
                });
            }

            function selectDatabase(databaseName) {
                setModuleUnitTestConfigPropertyValue('db_name', databaseName, taskName);
                done();
            }
        }
    });
});

gulp.task('_get-available-odoo-databases', function(done) {
    var taskName = this.seq[0];
    if (isOpenerpServerPropsEmpty()) {
        runSequence(['_read-openerp-server-config'], getDatabaseNames);
    } else getDatabaseNames();

    function getDatabaseNames(err) {
        if (!err) {
            var config = {
                user: openerpServerProps.get('options.db_user'), //env var: PGUSER
                database: 'postgres', //env var: PGDATABASE
                password: openerpServerProps.get('options.db_password'), //env var: PGPASSWORD
                host: openerpServerProps.get('options.db_host'), // Server hosting the postgres database
                port: openerpServerProps.get('options.db_port')
            };
            var client = new pg.Client(config);
            // connect to our database
            client.connect(function(err) {
                if (err) throwPluginError(taskName, colors.red(err.message));

                // execute a query on our database
                var q = 'SELECT d.datname FROM pg_catalog.pg_database d where pg_catalog.pg_get_userbyid(d.datdba) = $1::text'
                client.query(q, [openerpServerProps.get('options.db_user')], function(err, result) {
                    if (err) throwPluginError(taskName, colors.red(err.message));

                    availableDatabaseNames = result.rows.map(function(row) {
                        return row.datname;
                    });

                    // disconnect the client
                    client.end(function(err) {
                        if (err) throwPluginError(taskName, colors.red(err.message));
                    });
                });
            });
            return client.on('end', done);
        }
    }
});

gulp.task('_execute-odoo-module-testing', function(done) {
    if (isOpenerpServerPropsEmpty()) {
        runSequence(['_read-module-unit-test-config-file'], executeOdooModuleTesting);
    } else executeOdooModuleTesting();

    function executeOdooModuleTesting(err) {
        if (!err) {
            var command = format('pushd "{0}" & python {1} & popd', moduleUpdateTestFolder, serverTestRunner);
            executeComand(command, 'EXECUTE MODULE UPDATE TESTING');
            done();
        }
    }
});

//UTILS FUNCTIONS
function executeModuleIntallOrUpdateTask(executeInstall, done) {
    var taskType = executeInstall ? 'install' : 'update';
    runSequence(['_read-module-unit-test-config-file'], function(err) {
        if (!err) {
            var args = [
                "'-c'",
                "openerp_server_config_file",
                "'-d'",
                "database_name",
                format("'-{0}'", taskType[0]),
                "module_name",
                "'--stop-after-init'"
            ];
            var pythonCommand = [
                "import os",
                "import utils",
                "utils.populate_sys_path()",
                "props = utils.get_module_unit_test_conf()",
                "module_name = os.path.basename(utils.get_module_path())",
                "openerp_server_config_file = os.path.join(props['odoo_server_folder'], 'openerp-server.conf')",
                "database_name = props['db_name']",
                format("utils.run_odoo_server([{0}])", args.join())
            ].join('; ');
            var command = format(
                'pushd "{0}" && python -c "{1}" & popd', moduleUpdateTestFolder, pythonCommand
            );
            executeCommandTask(command, format('{0} MODULE', taskType.toUpperCase()), done);
        }
    });
}

function throwPluginError(taskName, msg) {
    throw new util.PluginError({
        plugin: taskName,
        message: msg
    });
}

function setModuleUnitTestConfigPropertyValue(property, value, taskName) {
    if (getModuleUnitTestConfigPropertyNames().find(
            function(item) {
                return item == property;
            })) {
        moduleUnitTestConfigData[property] = value;
    } else throwPluginError(taskName, format('The {0} property name is not valid.', colors.red(property)));
}

function isOpenerpServerPropsEmpty() {
    return !openerpServerProps.hasOwnProperty('_properties');
}

function applyFormat() {
    var pattern = Array.isArray(arguments[0]) ? arguments[0].join('\n') : arguments[0];
    var args = [pattern].concat(Array.prototype.slice.call(arguments, 1));
    return format.apply(format, args);
}

function getNotFoundOwnProperties(obj, propKeyNameArray) {
    return propKeyNameArray.filter(function(key) {
        return !obj.hasOwnProperty(key);
    });
}

function newFile(name, contents) {
    //uses the node stream object
    var readableStream = require('stream').Readable({ objectMode: true });
    //reads in our contents string
    readableStream._read = function() {
        this.push(new util.File({ cwd: "", base: "", path: name, contents: new Buffer(contents) }));
        this.push(null);
    }
    return readableStream;
};

function compilePythonOnWatchEvent(event) {
    if (path.extname(event.path).toLowerCase().match(/^\.py$/)) {
        executeComand(
            format('python -m py_compile {0}', event.path),
            format('Compiling {0}...', event.path.replace(__dirname, '.'))
        );
    }
}

function executeComand(command, title) {
    title = title || '';
    console.log(format('{0} BEGIN {1} {0}', colors.yellow('-------------------------'), colors.green(title)));
    execSync(command, { stdio: 'inherit' });
    console.log(format('{0} END {1} {0}', colors.yellow('--------------------------'), colors.green(title)));
}

function existHtmlReportFiles() {
    return [
        htmlTestIndexReportFile,
        htmlTestModuleUpdateProcessReportFile,
        htmlTestModuleReportFile
    ].reduce(function(current, file) {
        return current && fs.existsSync(file);
    }, true);
}

function createDefaultHtmlReportFiles() {
    createHtmlReportIndexFile();
    createDefaultHtmlReportFrameFiles();
}

function executeCommandTask(command, title, done) {
    executeComand(command, title);
    done();
}

function getModuleUnitTestConfigPropertyNames() {
    return ['odoo_server_folder', 'db_name', 'test_module_update_process_report_file', 'test_module_report_file'];
}

function createFileIfNotExists(fileName, folder, content) {
    var filePath = path.join(folder, fileName);
    if (!fs.existsSync(filePath)) {
        console.log(format('Creating file: {0}', colors.green(filePath)));
        newFile(fileName, content)
            .pipe(gulp.dest(folder));
    }
}

function createHtmlReportIndexFile() {
    var content = format(
        '<html><head></head><frameset rows="50%,50%"><frame src="module_update({0}).html"><frame src="{0}.html"></frameset></html>',
        moduleName
    );
    createFileIfNotExists(htmlTestIndexReportFilename, testReportFolder, content);
}

function createDefaultHtmlReportFrameFiles() {
    var template =
        "<html><head><style type=\"text/css\" media=\"screen\">body\{font-family:verdana,arial,helvetica,sans-serif;font-size:80%;\}table\{font-size:100%;\}h1\{font-size:16pt;color:gray;\}.heading\{margin-top:0ex;margin-bottom:1ex;\}.heading .attribute\{margin-top:1ex;margin-bottom:0;\}#result_table\{width:80%;border-collapse:collapse;border:1px solid #777;\}#header_row\{font-weight:bold;color:white;background-color:#777;\}#result_table td\{border:1px solid #777;padding:2px;\}#total_row\{font-weight:bold;\}</style></head><body><div class='heading'><h1></h1><p class='attribute'><strong>Start Time:</strong> No data available</p><p class='attribute'><strong>Duration:</strong>  No data available</p><p class='attribute'><strong>Status:</strong> No test report generated yet</p></div><table id='result_table'><tr id='header_row'><td>Test Group/Test case</td><td>Count</td><td>Pass</td><td>Fail</td><td>Error</td><td>View</td></tr><tr id='total_row'><td>Total</td><td>0</td><td>0</td><td>0</td><td>0</td><td>&nbsp;</td></tr></table></body></html>";
    var titles = ['', ' UPDATING process'].map(function(value) {
        return format('Testing module{0}: {1}', value, moduleName);
    });

    [htmlTestModuleReportFilename, htmlTestModuleUpdateProcessReportFilename].forEach(function(fileName) {
        var content = template.replace('<h1></h1>', format('<h1>{0}</h1>', titles.shift()));
        createFileIfNotExists(fileName, testReportFolder, content);
    });
}

//CLASSES
function PythonHTMLTestRunnerReportParser(htmlFrameReportFile) {
    var stack = [{}];
    var report = {
        testClasses: [],
        testMethods: {},
        total: {},
        head: {},
        head_row: {}
    };
    var parser = new htmlparser.Parser({
        onopentag: _onopentag,
        ontext: _ontext,
        onclosetag: _onclosetag
    }, {
        decodeEntities: true
    });
    console.log(colors.green('Parsing html report file...'));
    parser.write(fs.readFileSync(htmlFrameReportFile));
    parser.end();

    return {
        //display
        getHeadReportTitle: getHeadReportTitle,
        getHeadReportStartTime: getHeadReportStartTime,
        getHeadReportDuration: getHeadReportDuration,
        getBodyReportHeaderDisplayData: getBodyReportHeaderDisplayData,
        getTestClassDisplayData: getTestClassDisplayData,
        getTestClassMethodDisplayData: getTestClassMethodDisplayData,
        getBodyReportFooterDisplayData: getBodyReportFooterDisplayData,
        //accessors
        getTestClasses: getTestClasses,
        getTestClassMethodsId: getTestClassMethodsId,
        getTestClasMethod: getTestClasMethod,
        getTestClassResultClass: getTestClassResultClass,
        getTestClassMethodResultClass: getTestClassMethodResultClass
    };

    //private methods
    function _onopentag(name, attribs) {
        _populateReport(name, attribs);
        var parent = stack[0];
        if (parent[name] == undefined)
            parent[name] = attribs;
        else {
            if (Array.isArray(parent[name]))
                parent[name].push(attribs);
            else parent[name] = [parent[name], attribs];
        }
        stack.unshift(attribs);
    }

    function _ontext(text) {
        stack[0]['text'] = text;
    }

    function _onclosetag(tagname) {
        stack.shift();
    }

    function _populateReport(name, attribs) {
        if (attribs.id && name == "tr") {
            if (attribs.id.match(/^.t\d+\.\d+$/))
                report.testMethods[attribs.id] = attribs;
            else if (attribs.id.match(/^total_row$/))
                report.total = attribs;
            else if (attribs.id.match(/^header_row$/))
                report.head_row = attribs;
        } else if (attribs.class) {
            if (name == "tr" && attribs.class.match(/^failClass|errorClass|passClass$/))
                report.testClasses.push(attribs);
            else if (name == "div" && attribs.class.match(/^heading$/))
                report.head = attribs;
        }
    }

    function _truncateDescription(text) {
        var idx = text.indexOf(":");
        if (idx > -1)
            text = text.substring(0, idx);
        return text;
    }

    function _getHeadReportData(index) {
        var key = report.head.p[index].strong.text.replace(/^(.*):$/, '$1');
        var value = report.head.p[index].text.trim();
        return { 'key': key, 'value': value };
    }

    //public methods
    function getTestClasses() {
        return report.testClasses;
    }

    function getHeadReportTitle() {
        return report.head.h1.text;
    }

    function getHeadReportStartTime() {
        return _getHeadReportData(0);
    }

    function getHeadReportDuration() {
        return _getHeadReportData(1);
    }

    function getBodyReportHeaderDisplayData() {
        return getTestClassDisplayData(report.head_row);
    }

    function getBodyReportFooterDisplayData() {
        return getTestClassDisplayData(report.total);
    }

    function getTestClassDisplayData(testClass) {
        return testClass.td.filter(function(value, index) {
            return index < 5;
        }).map(function(td, index) {
            return index == 0 ? _truncateDescription(td.text) : td.text;
        });
    }

    function getTestClassMethodsId(testClass) {
        var regex = /^javascript:showClassDetail\('.(\d+)',(\d+)\)$/;
        var chunks = testClass.td[5].a.href.replace(regex, '$1 $2').split(" ");
        var testClassId = parseInt(chunks[0]);
        return new Array(parseInt(chunks[1])).fill(0).reduce(function(ids, value, index) {
            return ids.concat(
                ['p', 'f'].map(function(prefix) {
                    return format('{0}t{1}.{2}', prefix, testClassId, index + 1);
                }).filter(function(id) {
                    return report.testMethods.hasOwnProperty(id);
                })
            );
        }, []);
    }

    function getTestClasMethod(methodId) {
        return report.testMethods[methodId];
    }

    function getTestClassMethodDisplayData(testClassMethod) {
        return _truncateDescription(testClassMethod.td[0].div.text);
    }

    function getTestClassResultClass(testClass) {
        return testClass.class;
    }

    function getTestClassMethodResultClass(testClassMethod) {
        return testClassMethod.td[0].class;
    }
}

function PythonHTMLTestRunnerShellTableReport() {
    var parser = null;
    var table = new Table({
        chars: { 'right': '', 'right-mid': '', 'bottom-right': '', 'top-right': '' },
        colWidths: [80, 8, 6, 6, 8]
    });

    var reportSummary = [];
    var reportSummaryUtils = [
        function(data) {
            table.push([data.key, { colSpan: 4, content: data.value }]);
        },
        function(data) {
            table.push(_buildTableRow('total_row', data));
        }
    ];
    [htmlTestModuleUpdateProcessReportFile, htmlTestModuleReportFile].forEach(function(reportFile) {
        parser = PythonHTMLTestRunnerReportParser(reportFile);
        _buildHeadReportTitle();
        _buildHeadReport();
        _buildBodyReportTitle();
        _buildBodyReportHeader();
        _buildBodyReport();
        _buildBodyReportFooter();

        var value = parser.getHeadReportStartTime();
        value.key = format('{0} {1}', colors.cyan(parser.getHeadReportTitle()), colors.yellow(value.key));
        reportSummary.push(value);
        reportSummary.push(parser.getBodyReportFooterDisplayData());
    });
    table.push([{ colSpan: 5, content: colors.green('REPORT SUMMARY'), hAlign: 'center' }]);
    reportSummary.forEach(function(data) {
        var func = reportSummaryUtils.shift();
        func(data);
        reportSummaryUtils.push(func);
    });

    return {
        show: function() {
            console.log(table.toString());
        }
    }

    function _buildHeadReportTitle() {
        table.push([{ colSpan: 5, content: colors.cyan(parser.getHeadReportTitle()), hAlign: 'center' }]);
    }

    function _buildHeadReport() {
        [parser.getHeadReportStartTime()].concat([parser.getHeadReportDuration()])
            .forEach(function(data) {
                table.push([colors.yellow(data.key), { colSpan: 4, content: data.value }]);
            });
    }

    function _buildBodyReportTitle() {
        table.push([{ colSpan: 5, content: colors.green('Tests Report'), hAlign: 'center' }]);
    }

    function _buildBodyReportHeader() {
        table.push(_buildTableRow('header_row', parser.getBodyReportHeaderDisplayData()));
    }

    function _buildBodyReport() {
        parser.getTestClasses().forEach(function(testClass) {
            table.push(
                _buildTableRow(
                    parser.getTestClassResultClass(testClass),
                    parser.getTestClassDisplayData(testClass)
                )
            );

            parser.getTestClassMethodsId(testClass).forEach(function(methodId) {
                var testClassMethod = parser.getTestClasMethod(methodId);
                var resultClass = parser.getTestClassMethodResultClass(testClassMethod);
                var icon = icons[resultClass];
                var text = parser.getTestClassMethodDisplayData(testClassMethod);
                table.push([{
                    colSpan: 5,
                    content: colorChooser[resultClass](format(' {0} {1}', icon, text)),
                    style: { 'padding-left': 3 }
                }]);
            });
        });
    }

    function _buildBodyReportFooter() {
        table.push(_buildTableRow('total_row', parser.getBodyReportFooterDisplayData()));
    }

    function _buildTableRow(firstColumnColorKey, data) {
        colorPalette[0] = colorChooser[firstColumnColorKey];
        return data.map(function(value, index) {
            return colorPalette[index](value);
        });
    }
}