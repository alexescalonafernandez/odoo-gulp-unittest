# -*- encoding: utf-8 -*-
# @author -  Alexander Escalona Fernández <alexescalonafernandez@gmail.com>

import sys
import os
import json

def get_module_path():
    return os.path.abspath(os.path.join(os.path.dirname(__file__),".."))

def get_module_metadata():
    with open(os.path.join(get_module_path() ,'__openerp__.py'), 'r') as metadata:
        config = eval(metadata.read())
    return config

def get_module_unit_test_conf():
    with open(os.path.join(os.path.dirname(__file__), 'unit_test_config.json')) as json_data:
        props = json.load(json_data)
    return props

def populate_sys_path():
    for folder in [get_module_unit_test_conf()['odoo_server_folder'], get_module_path()]:
        sys.path.append(folder)
        for root, dirs, files in os.walk(folder, topdown=False):
            for name in files:
                if name == '__init__.py':
                    sys.path.append(root)

def run_odoo_server(args):
    from openerp.cli.server import Server
    server = Server()
    server.run(args)