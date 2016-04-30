#!/usr/bin/env perl
use strict;
use warnings;
use Fatal qw(open close rename);
use File::stat;

my $version = shift or die "<version> is required";

my %filters = (
    './package.json' => sub {
        s/("version"\s*:\s*)"[^"]*"/$1"$version"/; # "version": "1.2.3"
    },
    './lib/sgfgrove/gametree.js' => sub {
        s/(\@license [^\d]*).*/$1$version/; # @license sgfgrove-gametree 1.2.3
    },
);

# https://metacpan.org/pod/ShipIt::Step::ChangeAllVersions
while ( my ($file, $filter) = each %filters ) {
    my $mode = stat($file)->mode;

    open my $in, '<', $file;
    open my $out, '>', "$file.tmp";

    while ( <$in> ) {
        $filter->();
        print $out $_;
    }

    close $in;
    close $out;

    rename $file => "$file~";
    rename "$file.tmp" => $file;
    chmod $mode, $file;
}

if ( !system('npm', 'test') ) {
    for my $file ( keys %filters ) {
        unlink "$file~";
    }
}
else {
    for my $file ( keys %filters ) {
        rename "$file~" => $file;
    }
    die "'npm test' did not exit with 0";
}

system 'git', 'add', '.';
system 'git', 'commit', '-m', "version $version";
system 'git', 'tag', '-a', "v$version", '-m', "version $version";

