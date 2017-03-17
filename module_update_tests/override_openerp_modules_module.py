# -*- encoding: utf-8 -*-
# @author -  Alexander Escalona Fernández <alexescalonafernandez@gmail.com>

import os
import unittest
import openerp
import openerp.modules.module as toExtends
import threading
import time
import HTMLTestRunner
import utils

runs_at_install = toExtends.runs_at_install
_logger = toExtends._logger

def run_unit_tests(module_name, dbname, position=runs_at_install):
    """
    :returns: ``True`` if all of ``module_name``'s tests succeeded, ``False``
              if any of them failed.
    :rtype: bool
    """
    _logger.info('CURRENT_MODULE %s running tests.', module_name)
    global current_test
    current_test = module_name
    mods = toExtends.get_test_modules(module_name)
    threading.currentThread().testing = True
    r = True
    suite = unittest.TestSuite()
    for m in mods:
        suite.addTests(unittest.TestLoader().loadTestsFromModule(m))

    if suite.countTestCases():
        t0 = time.time()
        t0_sql = openerp.sql_db.sql_counter
        _logger.info('%s running tests.', module_name)
        
        report_file = os.path.join(
            utils.get_module_path(), 
            utils.get_module_unit_test_conf()['test_module_report_file']
        )
        
        outfile = open(report_file, 'wb')
        runner = HTMLTestRunner.HTMLTestRunner(stream=outfile, title="Testing module: {0}".format(module_name),verbosity = 2)
        result = runner.run(suite)
        if time.time() - t0 > 5:
            _logger.log(25, "%s tested in %.2fs, %s queries", module_name, time.time() - t0, openerp.sql_db.sql_counter - t0_sql)
        if not result.wasSuccessful():
            r = False
            _logger.error("Module %s: %d failures, %d errors", module_name, len(result.failures), len(result.errors))

    current_test = None
    threading.currentThread().testing = False
    return r