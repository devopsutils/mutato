import * as codeBuild from '@aws-cdk/aws-codebuild';
import * as codePipeline from '@aws-cdk/aws-codepipeline';
import * as codePipelineActions from '@aws-cdk/aws-codepipeline-actions';
import * as ecr from '@aws-cdk/aws-ecr';
import * as cdk from '@aws-cdk/core';
import * as assert from 'assert';
import * as debug from 'debug';
import * as _ from 'lodash';
import { config } from '../config';
import { BaseConstruct } from './interfaces';

interface ContainerProps {
  /** build time parameters passed to "docker build" */
  buildArgs?: { [key: string]: string };
  /** path to Dockerfile (default: Dockerfile) */
  file?: string;
  /** path to build context (default: current working directory) */
  context?: string;
  /** image's push URI. leave empty if using AWS ECR */
  uri?: string;
}

/**
 * a construct abstracting a single Dockerfile. This class does not participate
 * in authentication, building, or pushing the actual image of the container.
 */
class Container extends BaseConstruct {
  public readonly props: ContainerProps;
  public readonly needsBuilding: boolean;
  private readonly _repo?: ecr.Repository;
  private readonly _debug: debug.Debugger;
  private readonly _repositoryName: string;

  /** @hideconstructor */
  constructor(scope: cdk.Construct, id: string, props: ContainerProps) {
    super(scope, id);

    this._debug = debug(`mu:constructs:container:${id}`);
    this.props = _.defaults(props, {
      buildArgs: {},
      context: '.',
      file: '',
      uri: ''
    });

    this._debug('creating a container construct with props: %o', this.props);
    assert.ok(this.props.context);
    assert.ok(_.isString(this.props.uri));

    // by default, repositoryName is the same as URI passed in
    this._repositoryName = this.props.uri as string;

    if (this.props.file && !this.props.uri) {
      this._debug('container is building for AWS ECR');
      const git = config.getGithubMetaData();
      this._repositoryName = `mu/${git.identifier}`;
      this._repo = new ecr.Repository(this, 'repository', {
        removalPolicy: cdk.RemovalPolicy.DESTROY,
        repositoryName: this._repositoryName
      });
      const uri = this._repo.repositoryUri;
      this._debug('overriding container uri to: %s', uri);
      this.props.uri = uri;
    }

    assert.ok(this.props.uri);
    assert.ok(this._repositoryName);
    this._debug('uri: %s, name: %s', this.props.uri, this._repositoryName);
    this.needsBuilding = !!this.props.file;
  }

  /**
   * Get the container image's URI for use in ECS. Optionally caller can be used
   * to get a portable URI independent of the stack building this container with
   * a precondition that caller exists in the same AWS region and account.
   * @param caller optional construct in a different stack needing to access the
   * image URI without referencing the stack that is building the container.
   */
  getImageUri(caller?: cdk.Construct): string {
    if (caller) {
      const stack = cdk.Stack.of(caller);
      const uri = `${stack.account}.dkr.ecr.${stack.region}.${stack.urlSuffix}/${this._repositoryName}`;
      return this._repo ? uri : (this.props.uri as string);
    } else return this.props.uri as string;
  }

  /** @returns a CodeBuild action that can be embedded inside a CodePipeline */
  createBuildAction(
    source: codePipeline.Artifact,
    pipeline: codePipeline.Pipeline
  ): codePipelineActions.CodeBuildAction {
    assert.ok(this.needsBuilding, 'container is not part of the pipeline');
    const project = new codeBuild.PipelineProject(
      cdk.Stack.of(pipeline),
      `container-project-${this.node.id}`,
      {
        environment: {
          privileged: true,
          buildImage: codeBuild.LinuxBuildImage.STANDARD_2_0,
          environmentVariables: config.toBuildEnvironmentMap()
        },
        buildSpec: codeBuild.BuildSpec.fromObject({
          version: 0.2,
          phases: {
            install: { 'runtime-versions': { docker: 18 } },
            pre_build: { commands: [this.loginCommand] },
            build: { commands: [this.buildCommand] },
            post_build: { commands: [this.pushCommand] }
          }
        })
      }
    );

    this._repo?.grantPullPush(project);
    const buildAction = new codePipelineActions.CodeBuildAction({
      actionName: `container-build--${this.node.id}`,
      input: source,
      project
    });

    return buildAction;
  }

  /** @returns shell command containing "docker login" */
  get loginCommand(): string {
    assert.ok(this.needsBuilding, 'container is not part of the pipeline');
    const region = cdk.Stack.of(this).region;
    return this._repo
      ? `$(aws ecr get-login --no-include-email --region ${region})`
      : `docker login -u ${config.opts.docker.user} -p ${config.opts.docker.pass}`;
  }

  /** @returns shell command containing "docker build" */
  get buildCommand(): string {
    assert.ok(this.needsBuilding, 'container is not part of the pipeline');
    const buildArg = _.reduce(
      this.props.buildArgs,
      (accumulate, value, key) => `${accumulate} --build-arg ${key}="${value}"`,
      ''
    ).trim();
    const f = this.props.file;
    const t = this.getImageUri();
    // TODO: escape for shell args here to prevent shell attacks
    return `docker build ${buildArg} -t ${t} -f ${f} ${this.props.context}`;
  }

  /** @returns shell command containing "docker push" */
  get pushCommand(): string {
    assert.ok(this.needsBuilding, 'container is not part of the pipeline');
    return `docker push ${this.getImageUri()}`;
  }
}

export { Container as container };
