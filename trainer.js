var so = require('stringify-object');
var svm = require('node-svm');
var datafile = './output3.ds';
var testfile = './testdata2.json';
var clf = new svm.CSVC({
    gamma: [0.01, 0.1],
    c: 8,
    kFold: 4,
    normalize: true,
    reduce: true,
    retainedVariance: 0.95
});

svm.read(datafile)
    .then(function(dataset) {
        console.log('training has started...');
        return clf.train(dataset)
            .progress(function(progress) {
                console.log('training progress: %d%', Math.round(progress*100));
            });
    })
    .then(function(trainedModel, trainingReport) {
        return svm.read(testfile);
    })
    .then(function(testset) {
        return clf.evaluate(testset);
    })
    .done(function(report) {
        console.log(report);
    });