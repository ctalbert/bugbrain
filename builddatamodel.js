var async = require('async');
var quantifyBugzillaData = require('./quantifybugzilladata');

var queries = {'fx35': {'classifier': 1,
                    'query': 'https://bugzilla.mozilla.org/rest/bug?j_top=OR&f1=cf_tracking_firefox35&list_id=12089932&o1=equals&resolution=---&resolution=FIXED&resolution=INVALID&resolution=WONTFIX&resolution=DUPLICATE&resolution=WORKSFORME&resolution=INCOMPLETE&resolution=SUPPORT&resolution=EXPIRED&resolution=MOVED&query_format=advanced&chfield=[Bug%20creation]&chfieldfrom=2014-09-02&bug_status=UNCONFIRMED&bug_status=NEW&bug_status=ASSIGNED&bug_status=REOPENED&bug_status=RESOLVED&bug_status=VERIFIED&bug_status=CLOSED&v1=%2B',
                     },
               'nontracked': {'classifier': 0,
                    'query': 'https://bugzilla.mozilla.org/rest/bug?bug_status=UNCONFIRMED&bug_status=NEW&bug_status=ASSIGNED&bug_status=REOPENED&bug_status=RESOLVED&bug_status=VERIFIED&bug_status=CLOSED&chfield=[Bug%20creation]&chfieldfrom=2014-09-02&f1=cf_tracking_firefox35&f2=cf_tracking_firefox36&f3=cf_tracking_firefox37&f4=cf_tracking_firefox38&j_top=OR&list_id=12089961&o1=notequals&o2=notequals&o3=notequals&o4=notequals&product=Core&product=Firefox&product=Firefox%20for%20Android&product=Firefox%20for%20iOS&product=NSPR&product=NSS&product=Toolkit&query_format=advanced&resolution=---&resolution=FIXED&resolution=INVALID&resolution=WONTFIX&resolution=DUPLICATE&resolution=WORKSFORME&resolution=INCOMPLETE&resolution=SUPPORT&resolution=EXPIRED&resolution=MOVED&v1=%2B&v2=%2B&v3=%2B&v4=%2B&order=priority%2Cbug_severity&limit=5000',
                },
                'fx36': {'classifier': 1,
                    'query': 'https://bugzilla.mozilla.org/rest/bug?j_top=OR&f1=cf_tracking_firefox36&list_id=12089932&o1=equals&resolution=---&resolution=FIXED&resolution=INVALID&resolution=WONTFIX&resolution=DUPLICATE&resolution=WORKSFORME&resolution=INCOMPLETE&resolution=SUPPORT&resolution=EXPIRED&resolution=MOVED&query_format=advanced&chfield=[Bug%20creation]&chfieldfrom=2014-09-02&bug_status=UNCONFIRMED&bug_status=NEW&bug_status=ASSIGNED&bug_status=REOPENED&bug_status=RESOLVED&bug_status=VERIFIED&bug_status=CLOSED&v1=%2B',
                },
                'fx37': {'classifier': 1,
                    'query': 'https://bugzilla.mozilla.org/rest/bug?j_top=OR&f1=cf_tracking_firefox37&list_id=12089932&o1=equals&resolution=---&resolution=FIXED&resolution=INVALID&resolution=WONTFIX&resolution=DUPLICATE&resolution=WORKSFORME&resolution=INCOMPLETE&resolution=SUPPORT&resolution=EXPIRED&resolution=MOVED&query_format=advanced&chfield=[Bug%20creation]&chfieldfrom=2014-09-02&bug_status=UNCONFIRMED&bug_status=NEW&bug_status=ASSIGNED&bug_status=REOPENED&bug_status=RESOLVED&bug_status=VERIFIED&bug_status=CLOSED&v1=%2B',
                },
                'fx34': {'classifier': 1,
                    'query': 'https://bugzilla.mozilla.org/rest/bug?j_top=OR&f1=cf_tracking_firefox34&list_id=12089932&o1=equals&resolution=---&resolution=FIXED&resolution=INVALID&resolution=WONTFIX&resolution=DUPLICATE&resolution=WORKSFORME&resolution=INCOMPLETE&resolution=SUPPORT&resolution=EXPIRED&resolution=MOVED&query_format=advanced&chfield=[Bug%20creation]&chfieldfrom=2014-07-21&bug_status=UNCONFIRMED&bug_status=NEW&bug_status=ASSIGNED&bug_status=REOPENED&bug_status=RESOLVED&bug_status=VERIFIED&bug_status=CLOSED&v1=%2B'
                }
};
var testingdata = 'https://bugzilla.mozilla.org/rest/bug?list_id=12095830&resolution=---&resolution=FIXED&chfieldto=2015-03-31&chfield=[Bug%20creation]&query_format=advanced&chfieldfrom=2015-02-23&product=Core&product=Firefox&product=Toolkit&limit=200';

var completedqueries = 0, totalqueries = 0;

function done() {
    completedqueries++;
    console.log("\n=== Completed: " + completedqueries + "/" + totalqueries + " queries =====");
}

var q = async.queue(function(task, callback) {
    quantifyBugzillaData(task.query, task.classifier, task.outputfile);
    callback();
});

for (var k in queries){
    q.push({'query': queries[k]['query'], 'classifier': queries[k]['classifier'],
        'outputfile': 'output.ds'}, done);
    totalqueries++;
}
//q.push({'query': testingdata, 'classifier': -1, 'outputfile': 'testdata.ds'}, done);
//totalqueries++;
