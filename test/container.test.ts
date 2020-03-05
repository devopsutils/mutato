import * as cdkAssert from '@aws-cdk/assert';
import * as cdk from '@aws-cdk/core';
import * as chai from 'chai';
import * as chaiAsPromised from 'chai-as-promised';
import { container } from '../lib/constructs';

chai.use(chaiAsPromised);

describe('Container Construct Tests', () => {
  describe('DockerHub Tests', () => {
    it('should not create an ECR repository when a tag is given', () => {
      const app = new cdk.App();
      const stack = new cdk.Stack(app, 'MyTestStack');
      const construct = new container(stack, 'MyTestContainer', {
        file: 'Dockerfile',
        uri: 'stelligent/mu'
      });
      cdkAssert
        .expect(stack)
        .notTo(cdkAssert.haveResource('AWS::ECR::Repository'));
      chai.assert.equal(construct.props.uri, 'stelligent/mu');
    });

    it('should ba able to generate a build command with a tag', () => {
      const app = new cdk.App();
      const stack = new cdk.Stack(app, 'MyTestStack');
      const construct = new container(stack, 'MyTestContainer', {
        file: 'Dockerfile',
        uri: 'stelligent/mu'
      });
      chai.assert.equal(construct.props.uri, 'stelligent/mu');
      chai
        .expect(construct.buildCommand)
        .to.be.equal(`docker build  -t stelligent/mu -f Dockerfile .`);
      const construct2 = new container(stack, 'MyTestContainer2', {
        buildArgs: {
          key1: 'val1',
          key2: 'val2'
        },
        file: 'Dockerfile2',
        context: 'Context2',
        uri: 'stelligent/mu'
      });
      chai
        .expect(construct2.buildCommand)
        .to.be.equal(
          `docker build --build-arg key1="val1" --build-arg key2="val2" -t stelligent/mu -f Dockerfile2 Context2`
        );
    });

    it('should ba able to generate a push command without a tag', () => {
      const app = new cdk.App();
      const stack = new cdk.Stack(app, 'MyTestStack');
      const construct = new container(stack, 'MyTestContainer', {
        file: 'Dockerfile',
        uri: 'stelligent/mu'
      });
      chai.assert.equal(construct.props.uri, 'stelligent/mu');
      const uri = construct.getImageUri();
      chai.expect(construct.pushCommand).to.be.equal(`docker push ${uri}`);
    });
  });

  describe('ECR Tests', () => {
    it('should create an ECR repository when no tag is given', () => {
      const app = new cdk.App();
      const stack = new cdk.Stack(app, 'MyTestStack');
      new container(stack, 'MyTestContainer', {
        file: 'Dockerfile'
      });
      cdkAssert
        .expect(stack)
        .to(cdkAssert.haveResource('AWS::ECR::Repository'));
    });

    it('should ba able to generate a build command without a tag', () => {
      const app = new cdk.App();
      const stack = new cdk.Stack(app, 'MyTestStack');
      const construct = new container(stack, 'MyTestContainer', {
        file: 'Dockerfile'
      });

      const uri1 = construct.getImageUri();
      chai
        .expect(construct.buildCommand)
        .to.be.equal(`docker build  -t ${uri1} -f Dockerfile .`);
      const construct2 = new container(stack, 'MyTestContainer2', {
        buildArgs: {
          key1: 'val1',
          key2: 'val2'
        },
        file: 'Dockerfile2',
        context: 'Context2'
      });
      const uri2 = construct2.getImageUri();
      chai
        .expect(construct2.buildCommand)
        .to.be.equal(
          `docker build --build-arg key1="val1" --build-arg key2="val2" -t ${uri2} -f Dockerfile2 Context2`
        );
    });

    it('should ba able to generate a push command without a tag', () => {
      const app = new cdk.App();
      const stack = new cdk.Stack(app, 'MyTestStack');
      const construct = new container(stack, 'MyTestContainer', {
        file: 'Dockerfile'
      });

      const uri = construct.getImageUri();
      chai.expect(construct.pushCommand).to.be.equal(`docker push ${uri}`);
    });
  });
});
