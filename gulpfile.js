var fs = require('fs');
var gulp = require("gulp");
var gutil = require('gulp-util');
var shell = require('gulp-shell');
var rename = require("gulp-rename");
var runSequence = require('run-sequence');
var livereload = require('gulp-livereload');


gulp.task("default", function() {
    livereload.listen({start: true});
    runSequence(['serve-files', 'reload-changes', 'transpile-javascript']);
});

gulp.task("reload-changes", ['copy-html', 'copy-assets'], function() {
    gulp.watch('src/**/*.html', ['copy-html']);
    gulp.watch('assets/**/*', ['copy-assets']);
    gulp.watch('public/bundle.js', ['reload-javascript']);
});

gulp.task("serve-files", shell.task([
    'http-server ./public -s -p 3000 -c-1'
]));

gulp.task("transpile-javascript", shell.task([
    'webpack --progress --sort-assets-by --watch --colors'
]));

gulp.task("reload-javascript", function() {
    livereload.changed({path: 'bundle.js'});
});

gulp.task("copy-html", function() {
    gulp.src(['src/**/*.html'])
        .pipe(gulp.dest('public'))
        .pipe(livereload());
});

gulp.task("copy-assets", function() {
    gulp.src(['assets/**/*'])
        .pipe(gulp.dest('public/assets'))
        .pipe(livereload());
});