# odoo-gulp-unittest
The project **odoo-gulp-unittest** is an **Odoo Scaffolding Template** for _Odoo developers_, which can not use **Online Odoo Testing Tools** either because they _do not have access_ to the internet or it is _restricted_.

Even though Odoo allows us to apply **Unit Testing** on _module_ using the command:
```sh
odoo -c %odoo_installation_folder%\openerp-server.conf -d db_name -u module_name --stop-after-init --test-enable
```
the _Unit Test reports_ is showed in **text format**, which is _difficult to read_ by the **developer**, since the results of **Unit Tests** are mixed with other **log entries**, and it is also _necessary to read_ the **log entries** to know if the unit tests were executed, since if any of the _xml files_ of the **views have an error** for example, the **Unit Tests are not executed**.

As described above it _is necessary to generate_ the **Unit Test reports** in a _more readable format_ for **developers**. To achieve the above, **odoo-gulp-unittest** uses [HTMLTestRunner](http://tungwaiyip.info/software/HTMLTestRunner.html) library for generating and storing _Unit Test reports_ in **HTML format**.

The [HTMLTestRunner](http://tungwaiyip.info/software/HTMLTestRunner.html) library is injected by **odoo-gulp-unittest** through a **set of python scripts**, which **override** _odoo test runner implemmentation_ **in runtime**. 

Taking into consideration that _source code editors_ like [Visual Studio Code](https://code.visualstudio.com/) provides an _integrated terminal_, **odoo-gulp-unittest** allows _to display in shell_ a **summary** of [HTMLTestRunner](http://tungwaiyip.info/software/HTMLTestRunner.html) _generated reports_ in **tabular format**.

In addition _to executing_ **Unit Tests** and _display a summary_ of them _in shell_, **odoo-gulp-unittest** also provides other _functionalities_: **compile** _python_ files, **install**/**update** module,  **auto compile**, **auto testing**, and _others_.

The previously mentioned _functionalities_ are _executed_ through **Gulp Tasks**. The goal of using **Gulp** is that it _facilitates_ the **implementation** of the functionalities, and the _code_ can be **easily understood and modified** by the _developers_, since **Gulp** is widely used today.

## odoo-gulp-unittest main Goals
* **Provides** an **Odoo Project Template**, which can be copied in **%odoo_instalation_folder%\server\openerp\cli\templates** folder.
* **Override** _Odoo Test Runner implemmentation_ **in runtime**. See [custom_test_runner](/module_update_tests/server_test_runner.py)
* **Generate** _unit test configuration json file_ with **odoo_server_folder**, **db_name** and other _properties_, for executing **intall**/**update**/**testing** module. See [create-module-unit-test-config-file](/gulpfile.js) **Gulp Task**.
* **Compile** _all python_ files. See [compile-all-py](/gulpfile.js) **Gulp Task**.
* **Execute** _module_ **Unit Tests** with [HTMLTestRunner](http://tungwaiyip.info/software/HTMLTestRunner.html) and _display report summary in shell_. See [test](/gulpfile.js) **Gulp Task**.
* **Display** _Unit Test_ reports summary in _shell_. See [show-test-report](/gulpfile.js) **Gulp Task**.
* **Watch** for _changes in python files_ and _compile_ it on save. See [auto-py-compile](/gulpfile.js) **Gulp Task**.
* **Show** _Unit Tests html report_ in _local web server_, **wait for changes for executing** _Unit Tests_, and **reload Unit Tests html report** when **Unit Tests process ends**. See [auto-test](/gulpfile.js) **Gulp Task**.
* **Install** _module_. See [execute-odoo-module-install](/gulpfile.js) **Gulp Task**. 
* **Update** _module_. See [execute-odoo-module-update](/gulpfile.js) **Gulp Task**. 

## How use odoo-gulp-unittest
1. **Download** source code from **this repository** and **copy it** in **%odoo_instalation_folder%\server\openerp\cli\templates** folder. If you **desire** you **can change** the _name of the copied_ folder.
2. In **%odoo_instalation_folder%\server\openerp-server.conf** _add a folder path_ for **storing** your _custom odoo modules_ in **addons_path** _property_ if you had not added it before.
3. **Open** _shell_ and **assuming for example** that the _name_ of copied folder in **%odoo_instalation_folder%\server\openerp\cli\templates** is **gulp-test** _execute_:
```sh
cd %my_custom_odoo_modules_path%
odoo scaffold my_new_module -t gulp-test
cd my_new_module
npm install
```
4. For _executing_ any of available **Gulp Tasks** in _previously opened shell_ **execute**:
```sh
gulp
```