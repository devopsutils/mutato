import {
  BuildEnvironmentVariable,
  BuildEnvironmentVariableType
} from '@aws-cdk/aws-codebuild';
import assert from 'assert';
import cp from 'child_process';
import debug from 'debug';
import _ from 'lodash';
import parseGithubUrl from 'parse-github-url';
import rc from 'rc';
import traverse from 'traverse';
import parse = require('parse-strings-in-object');

const log = debug('mu:config');

/**
 * @param name "rc" namespace
 * @param defaults default configuration object
 * @returns overridden configuration with "rc"
 */
function rcTyped<T>(name: string, defaults: T): T {
  const userConfig = rc(name, defaults);
  const parsedConfig = parse(userConfig);
  return parsedConfig as T;
}

// args passed to cp.execSync down when we extract defaults from environment
const gitRemoteCmd = 'git config --get remote.origin.url || true';
const gitBranchCmd = 'git rev-parse --abbrev-ref HEAD || true';

type StringEnvironmentVariableMap = { [key: string]: string };
type BuildEnvironmentVariableMap = { [key: string]: BuildEnvironmentVariable };

log('extracting configuration');
export const config = rcTyped('mu', {
  opts: {
    git: {
      remote: cp
        .execSync(gitRemoteCmd, { encoding: 'utf8', timeout: 1000 })
        .trim(),
      branch: cp
        .execSync(gitBranchCmd, { encoding: 'utf8', timeout: 1000 })
        .trim(),
      secret: _.get(process.env, 'GITHUB_TOKEN', '')
    },
    docker: {
      user: _.get(process.env, 'DOCKER_USERNAME', ''),
      pass: _.get(process.env, 'DOCKER_PASSWORD', '')
    },
    preprocessor: {
      timeout: '10s'
    }
  },
  getGithubMetaData() {
    const meta = parseGithubUrl(this.opts.git.remote);
    /** @todo properly handle non Github repositories */
    assert.ok(meta, 'only Github remotes are supported');
    assert.ok(meta?.name, 'Github repo could not be determined');
    assert.ok(meta?.owner, 'Github owner could not be determined');
    const repo = meta?.name as string;
    const owner = meta?.owner as string;
    const branch = this.opts.git.branch;
    const id = `${owner}-${repo}-${branch}`.replace(/[^A-Za-z0-9-]/g, '-');
    return {
      repo: meta?.name as string,
      owner: meta?.owner as string,
      branch: this.opts.git.branch,
      /** this can be used in CDK names and IDs to uniquely ID a resource */
      identifier: id
    };
  },
  toStringEnvironmentMap() {
    return traverse(this).reduce(function(acc, x) {
      if (this.isLeaf && this.key !== '_' && !_.isFunction(x))
        acc[`mu_${this.path.join('__')}`] = `${x}`;
      return acc;
    }, {}) as StringEnvironmentVariableMap;
  },
  toBuildEnvironmentMap() {
    return _.transform(
      this.toStringEnvironmentMap(),
      (result: BuildEnvironmentVariableMap, value, key) => {
        result[key] = {
          type: BuildEnvironmentVariableType.PLAINTEXT,
          value
        };
      },
      {}
    );
  }
});

log('Mu configuration: %o', config.toStringEnvironmentMap());
