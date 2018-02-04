const fs  = require("fs");
const path = require("path");
const os = require("os");
const chalk = require("chalk");
const glob = require("glob");
const minimist = require("minimist");
const diff = require("./util/diff");
const asc = require("../bin/asc.js");

const args = minimist(process.argv.slice(2), {
  boolean: [ "create", "help" ],
  alias: { h: "help" }
});

if (args.help) {
  console.log("Usage: npm run test:compiler -- [test1, test2 ...] [--create]\n");
  console.log("Runs all tests if no tests have been specified.");
  console.log("Recreates affected fixtures if --create is specified.");
  process.exit(0);
}

var successes = 0;
var failures = 0;

const basedir = path.join(__dirname, "compiler");

// Get a list of all tests
var tests = glob.sync("**/!(_)*.ts", { cwd: basedir });

// Run specific tests only if arguments are provided
if (args._.length) {
  tests = tests.filter(filename => args._.indexOf(filename.replace(/\.ts$/, "")) >= 0);
  if (!tests.length) {
    console.error("No matching tests: " + args._.join(" "));
    process.exit(1);
  }
}

// TODO: asc's callback is synchronous here. This might change.
tests.forEach(filename => {
  console.log(chalk.whiteBright("Testing compiler/" + filename));

  const basename = filename.replace(/\.ts$/, "");

  const stdout = createMemoryStream();
  const stderr = createMemoryStream(true);

  var failed = false;

  // TODO: also stdout/stderr and diff it (-> expected failures)

  // Build unoptimized
  asc.main([
    filename,
    "--baseDir", basedir,
    "-t", // -> stdout
    "--sourceMap"
  ], {
    stdout: stdout,
    stderr: stderr
  }, err => {
    if (err)
      stderr.write(err + os.EOL);
    if (args.create) {
      fs.writeFileSync(path.join(basedir, basename + ".wast"), stdout.toString(), { encoding: "utf8" });
      console.log("Recreated fixture.");
    } else {
      let actual = stdout.toString();
      let expected = fs.readFileSync(path.join(basedir, basename + ".wast"), { encoding: "utf8" });
      let diffs = diff(basename + ".wast", expected, actual);
      if (diffs !== null) {
        console.log(diffs);
        console.log(chalk.red("diff ERROR"));
        failed = true;
      } else
        console.log(chalk.green("diff OK"));
    }

    stdout.length = 0;
    stderr.length = 0;
    stderr.print = false;

    // Build optimized
    asc.main([
      filename,
      "--baseDir", basedir,
      "-t", basename + ".optimized.wast",
      "-b", // -> stdout
      "-O"
    ], {
      stdout: stdout,
      stderr: stderr
    }, err => {
      if (err)
        stderr.write(err + os.EOL);

      // Instantiate
      try {
        let exports = new WebAssembly.Instance(new WebAssembly.Module(stdout.toBuffer()), {
          env: {
            abort: function(msg, file, line, column) {
              // TODO
            },
            externalFunction: function() { },
            externalConstant: 1
          },
          my: {
            externalFunction: function() { },
            externalConstant: 2
          }
        });
        console.log(chalk.green("instantiate OK"));
      } catch (e) {
        console.log(chalk.red("instantiate ERROR: ") + e);
        failed = true;
      }

      if (failed) ++failures;
      else ++successes;
      console.log();
    });
  });
});

function createMemoryStream(print) {
  var stream = [];
  if (stream.print = print)
    stream.isTTY = process.stderr.isTTY;
  stream.write = function(chunk) {
    if (typeof chunk === "string") {
      this.push(Buffer.from(chunk, "utf8"));
      if (stream.print)
        process.stderr.write(chunk);
    } else
      this.push(chunk);
  };
  stream.toBuffer = function() {
    return Buffer.concat(this);
  };
  stream.toString = function() {
    return this.toBuffer().toString("utf8");
  };
  return stream;
}

if (failures) {
  process.exitCode = 1;
  console.log(chalk.red("ERROR: ") + failures + " compiler tests failed");
} else
  console.log("[ " + chalk.whiteBright("SUCCESS") + " ]");
