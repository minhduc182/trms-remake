import { builder } from './builder.js';

import './modules/auth/schema.js';
import './modules/master/schema.js';
import './modules/shift/schema.js';
import './modules/cost-config/schema.js';
import './modules/etp/schema.js';
import './modules/request/schema.js';
import './modules/dispatch-trip/schema.js';
import './modules/cost/schema.js';

export const schema = builder.toSchema();
