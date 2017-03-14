# -*- encoding: utf-8 -*-
# @author -  Alexander Escalona Fernández <alexescalonafernandez@gmail.com>

import os
import unittest
import json
import utils

utils.populate_sys_path()
props = utils.get_openerp_server_conf()
project_path = utils.get_module_path()

import HTMLTestRunner
import override_openerp_modules_module as override
import openerp.modules.module as toExtends
toExtends.run_unit_tests = override.run_unit_tests

suite = unittest.TestSuite()
test_loader = unittest.TestLoader()
suite = test_loader.discover('.', pattern='test_*.py')

module_name = utils.get_module_metadata()['name']

report_file = os.path.join(project_path, props['test_module_update_process_report_file'])
outfile = open(report_file, 'wb')
report_title = "Testing module UPDATING process: {0}".format(module_name)
runner = HTMLTestRunner.HTMLTestRunner(stream=outfile, title=report_title, verbosity = 2)
runner.run(suite)