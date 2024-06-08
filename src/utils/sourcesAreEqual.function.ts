import {InputSource} from '../interfaces/input-source.interface';
import equal from 'fast-deep-equal/es6';

/**
 * Check if the current list of inputs is equal to the new list of inputs.
 * inputs are considered equal if the sourceid, sourcename and displayname are the same.
 * New objects get created as there could be additional properties in the input source object.
 * @param newSources
 */
export function sourcesAreEqual(newSources: InputSource[], oldSources: InputSource[]) {
  const minSources = oldSources.map((inputSource) => {
    return {
      sourceid: inputSource.sourceid,
      sourcename: inputSource.sourcename,
      displayname: inputSource.displayname,
    };
  });
  const minNewSources = newSources.map((inputSource) => {
    return {
      sourceid: inputSource.sourceid,
      sourcename: inputSource.sourcename,
      displayname: inputSource.displayname,
    };
  });

  return equal(minSources, minNewSources);
}