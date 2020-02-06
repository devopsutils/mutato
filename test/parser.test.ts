import * as chai from 'chai';
import * as chaiAsPromised from 'chai-as-promised';
import * as fsx from 'fs-extra';
import * as _ from 'lodash';
import * as path from 'path';
import { Converter, Parser, PreProcessor, Validator } from '../lib/parser';
import * as px from '../lib/parser/exceptions';

chai.use(chaiAsPromised);

describe('Parser Module Tests', () => {
  describe('Parser class tests', () => {
    describe('.parseString tests', () => {
      it('should be able to parse a basic schema string', async () => {
        const parser = new Parser();
        const json = await parser.parseString(
          fsx.readFileSync(
            path.resolve(__dirname, 'fixtures/basic-schema.yml'),
            {
              encoding: 'utf-8'
            }
          )
        );
        chai.assert.isObject(json);
        chai.assert.deepEqual(json, {
          version: '0.0.0',
          mu: {
            fargate: {
              name: `app-${_.get(parser.context, 'build_time')}-${
                process.env.USER
              }`
            }
          }
        });
      });

      it('should be able to parse a basic schema file', async () => {
        const parser = new Parser();
        const json = await parser.parseFile(
          path.resolve(__dirname, 'fixtures/basic-schema.yml')
        );
        chai.assert.isObject(json);
        chai.assert.deepEqual(json, {
          version: '0.0.0',
          mu: {
            fargate: {
              name: `app-${_.get(parser.context, 'build_time')}-${
                process.env.USER
              }`
            }
          }
        });
      });

      it('should throw if file does not exist', async () => {
        const parser = new Parser();
        await chai.assert.isRejected(parser.parseFile('aliens.yml'));
      });

      it('should throw if schema is invalid', async () => {
        const parser = new Parser();
        await chai.assert.isRejected(
          parser.parseFile(
            path.resolve(__dirname, 'fixtures/invalid-schema.yml')
          )
        );
      });
    });
  });

  describe('Validator class tests', () => {
    describe('.validate tests', () => {
      it('should be able to validate a basic schema', () => {
        const convert = new Converter();
        const json = convert.convertString(
          fsx.readFileSync(
            path.resolve(__dirname, 'fixtures/basic-schema.yml'),
            {
              encoding: 'utf-8'
            }
          )
        );
        const validator = new Validator();
        chai.assert.isTrue(validator.validateObject(json));
      });

      it('should not throw if the input is not valid', () => {
        const validator = new Validator();
        chai.assert.doesNotThrow(() => {
          validator.validateObject({ invalid: 'yes' });
        });
      });
    });

    describe('fault tolerance when schema is missing', () => {
      before(async () => {
        await fsx.move(
          path.resolve(__dirname, '../lib/parser/mu.yml.schema.json'),
          path.resolve(__dirname, '../lib/parser/mu.yml.schema.json.bak')
        );
      });

      it('should throw an error if there is something wrong with the schema', () => {
        chai.assert.throws(() => {
          new Validator();
        }, px.InvalidMuSchemaError);
      });

      after(async () => {
        await fsx.move(
          path.resolve(__dirname, '../lib/parser/mu.yml.schema.json.bak'),
          path.resolve(__dirname, '../lib/parser/mu.yml.schema.json')
        );
      });
    });
  });

  describe('Converter class tests', () => {
    describe('.convertString tests', () => {
      it('should be able to convert a basic string', () => {
        const convert = new Converter();
        const result = convert.convertString(
          fsx.readFileSync(path.resolve(__dirname, 'fixtures/basic-yaml.yml'), {
            encoding: 'utf-8'
          })
        );
        chai.assert.isObject(result);
        chai.assert.deepEqual(result, {
          version: 0.1,
          mu: { fargate: { name: 'app', test: 'foo' } }
        });
      });

      it('should throw if the input is not YAML', () => {
        const convert = new Converter();
        chai.assert.throws(() => {
          convert.convertString('string');
        });
      });
    });
  });

  describe('PreProcessor class tests', () => {
    describe('.renderString tests', () => {
      it('should be able to render a basic string template', async () => {
        const pp = new PreProcessor();
        const input = 'time: {{ build_time }}';
        const result = await pp.renderString(input);
        chai.assert(!result.includes('{{ build_time }}'));
      });

      it('should throw with a string template and invalid context', async () => {
        const pp = new PreProcessor();
        const input = 'time: {{ invalid }}';
        chai.assert.isRejected(pp.renderString(input));
      });

      it('should be able to resolve environment variables', async () => {
        const pp = new PreProcessor();
        const result = await pp.renderString('user: {{ env("USER") }}');
        chai.assert.equal(result, `user: ${process.env.USER}`);
      });

      it('should throw when environment variable is not a string', async () => {
        const pp = new PreProcessor();
        await chai.assert.isRejected(pp.renderString('{{ env(USER) }}'));
        await chai.assert.isRejected(pp.renderString('{{ env(123) }}'));
        await chai.assert.isRejected(pp.renderString('{{ env() }}'));
      });

      it('should be able to resolve shell commands', async () => {
        const pp = new PreProcessor();
        const result = await pp.renderString(
          'user: {{ cmd("whoami | xargs echo") }}'
        );
        chai.assert.equal(result, `user: ${process.env.USER}`);
      });

      it('should throw when shell command is not a string', async () => {
        const pp = new PreProcessor();
        await chai.assert.isRejected(pp.renderString('{{ cmd(whomai) }}'));
        await chai.assert.isRejected(pp.renderString('{{ cmd(123) }}'));
        await chai.assert.isRejected(pp.renderString('{{ cmd() }}'));
      });

      it('should throw when shell commands exits with non zero code', async () => {
        const pp = new PreProcessor();
        await chai.assert.isRejected(
          pp.renderString('user: {{ cmd("exit 1") }}')
        );
      });
    });

    describe('.renderFile tests', () => {
      it('should be able to render a basic file template', async () => {
        const pp = new PreProcessor();
        const result = await pp.renderFile(
          path.resolve(__dirname, 'fixtures/basic-schema.yml')
        );
        chai.assert(!result.includes('{{'));
      });

      it('should throw when given an invalid file path', async () => {
        const pp = new PreProcessor();
        await chai.assert.isRejected(pp.renderFile('aliens.yml'));
      });
    });
  });
});
