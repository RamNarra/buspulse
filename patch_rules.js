const fs = require('fs');
let code = fs.readFileSync('firestore.rules', 'utf8');

code = code.replace(/student-\$\(request\.auth\.uid\)/g, "$('student-' + request.auth.uid)");
code = code.replace(/\(get\(\/databases/g, "get(/databases");
code = code.replace(/\)\.data\.routeId\)/g, ").data.routeId");

fs.writeFileSync('firestore.rules', code);
