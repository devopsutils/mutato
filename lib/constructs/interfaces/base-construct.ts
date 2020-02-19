import * as cdk from '@aws-cdk/core';
import * as packageJson from '../../../package.json';

/**
 * This interface is not exported on purpose! users must use the abstract class
 * instead. The abstract class has a minimal default implementation.
 */
interface IBaseConstruct extends cdk.Construct {
  initialize(): Promise<void>;
}

/**
 * Base class of all Mu managed constructs
 * It allows for async initialization of its CDK components
 */
export abstract class BaseConstruct extends cdk.Construct
  implements IBaseConstruct {
  /**
   * @hideconstructor
   * @param {cdk.Construct} scope CDK scope
   * @param {string} id construct ID
   */
  constructor(scope: cdk.Construct, id: string) {
    super(scope, id);

    cdk.Tag.add(this, 'mu:vendor', 'stelligent');
    cdk.Tag.add(this, 'mu:version', packageJson.version);
  }

  /**
   * subclasses can use this to perform async initialization
   *
   * @returns {void} nothingness. throws if unsuccessful
   */
  public initialize(): Promise<void> {
    return Promise.resolve();
  }
}
