# -*- encoding: utf-8 -*-
# @author -  Alexander Escalona Fernández <alexescalonafernandez@gmail.com>

import os
import unittest
import json
import utils

class TestModuleUpdate(unittest.TestCase):
    """ This class contains the unit tests for 'TestModuleUpdate'.

        Tests:
          - : Checks if the  works properly
    """

    def setUp(self):
        super(TestModuleUpdate, self).setUp()

    def test_module_update(self):
        module_name = utils.get_module_metadata()['name']
        props = utils.get_openerp_server_conf()
        try:
            utils.run_odoo_server(['-d', props['db_name'], '-u', module_name, '-r', props['db_user'], '-w', props['db_password'], 
                '--stop-after-init', '--test-enable', '--addons-path', props['addons_folder']])
        except SystemExit as e:
            if e.code < 0:
                raise
            else: self.assertEqual(e.code, 0)