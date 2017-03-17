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
        module_name = os.path.basename(utils.get_module_path())
        props = utils.get_module_unit_test_conf()
        try:
            utils.run_odoo_server(['-c', os.path.join(props['odoo_server_folder'], 'openerp-server.conf'), '-d', props['db_name'], '-u', module_name, '--stop-after-init', '--test-enable'])
        except SystemExit as e:
            if e.code < 0:
                raise
            else: self.assertEqual(e.code, 0)