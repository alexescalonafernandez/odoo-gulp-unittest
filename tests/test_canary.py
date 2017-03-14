# -*- coding: utf-8 -*-
from openerp.tests.common import TransactionCase
import os
import inspect
class TestCanary(TransactionCase):
    """ This class contains the unit tests for 'TestCanary'.

        Tests:
          - : Checks if the  works properly
    """

    def setUp(self):
        super(TestCanary, self).setUp()

    def test_canary(self):
        """ Checks if the unittest works properly """

        self.assertEqual(True, True)
        
