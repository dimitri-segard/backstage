/*
 * Copyright 2021 The Backstage Authors
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { CatalogApi, Location } from '@backstage/catalog-client';
import { Entity, ANNOTATION_ORIGIN_LOCATION } from '@backstage/catalog-model';
import { catalogApiRef } from '../../api';
import {
  act,
  renderHook,
  RenderHookResult,
} from '@testing-library/react-hooks';
import React, { ReactNode } from 'react';
import {
  UseUnregisterEntityDialogState,
  useUnregisterEntityDialogState,
} from './useUnregisterEntityDialogState';
import { TestApiProvider } from '@backstage/test-utils';

function defer<T>(): { promise: Promise<T>; resolve: (value: T) => void } {
  let resolve: (value: T) => void = () => {};
  const promise = new Promise<T>(_resolve => {
    resolve = _resolve;
  });
  return { promise, resolve };
}

describe('useUnregisterEntityDialogState', () => {
  const catalogApiMock = {
    getLocationByRef: jest.fn(),
    getEntities: jest.fn(),
    removeLocationById: jest.fn(),
    removeEntityByUid: jest.fn(),
  };
  const catalogApi = catalogApiMock as Partial<CatalogApi> as CatalogApi;

  const Wrapper = (props: { children?: React.ReactNode }) => (
    <TestApiProvider apis={[[catalogApiRef, catalogApi]]}>
      {props.children}
    </TestApiProvider>
  );

  let entity: Entity;
  let resolveLocation: (location: Location | undefined) => void;
  let resolveColocatedEntities: (entities: Entity[]) => void;

  beforeEach(() => {
    jest.resetAllMocks();

    const deferredLocation = defer<Location | undefined>();
    const deferredColocatedEntities = defer<Entity[]>();

    resolveLocation = deferredLocation.resolve;
    resolveColocatedEntities = deferredColocatedEntities.resolve;

    catalogApiMock.getLocationByRef.mockReturnValue(deferredLocation.promise);
    catalogApiMock.getEntities.mockReturnValue(
      deferredColocatedEntities.promise.then(items => ({ items })),
    );

    entity = {
      apiVersion: 'backstage.io/v1alpha1',
      kind: 'Component',
      metadata: {
        name: 'n',
        namespace: 'ns',
        annotations: {
          [ANNOTATION_ORIGIN_LOCATION]: 'url:https://example.com',
        },
      },
      spec: {},
    };
  });

  it('goes through the happy unregister path', async () => {
    let rendered: RenderHookResult<
      { children?: ReactNode },
      UseUnregisterEntityDialogState
    >;
    act(() => {
      rendered = renderHook(() => useUnregisterEntityDialogState(entity), {
        wrapper: Wrapper,
      });
    });

    expect(rendered!.result.current).toEqual({ type: 'loading' });

    resolveLocation({ type: 'url', target: 'https://example.com', id: 'x' });
    resolveColocatedEntities([entity]);

    await act(async () => {
      await rendered!.waitForNextUpdate();
    });

    expect(rendered!.result.current).toEqual({
      type: 'unregister',
      location: 'url:https://example.com',
      colocatedEntities: [{ kind: 'Component', namespace: 'ns', name: 'n' }],
      unregisterLocation: expect.any(Function),
      deleteEntity: expect.any(Function),
    });
  });

  it('chooses the bootstrap path when necessary', async () => {
    entity.metadata.annotations![ANNOTATION_ORIGIN_LOCATION] =
      'bootstrap:bootstrap';

    let rendered: RenderHookResult<
      { children?: ReactNode },
      UseUnregisterEntityDialogState
    >;
    act(() => {
      rendered = renderHook(() => useUnregisterEntityDialogState(entity), {
        wrapper: Wrapper,
      });
    });

    resolveLocation({ type: 'bootstrap', target: 'bootstrap', id: 'x' });
    resolveColocatedEntities([]);
    await act(async () => {
      await rendered!.waitForNextUpdate();
    });

    expect(rendered!.result.current).toEqual({
      type: 'bootstrap',
      location: 'bootstrap:bootstrap',
      deleteEntity: expect.any(Function),
    });
  });

  it('chooses only-delete when there was no location annotation', async () => {
    delete entity.metadata.annotations![ANNOTATION_ORIGIN_LOCATION];

    let rendered: RenderHookResult<
      { children?: ReactNode },
      UseUnregisterEntityDialogState
    >;
    act(() => {
      rendered = renderHook(() => useUnregisterEntityDialogState(entity), {
        wrapper: Wrapper,
      });
    });

    resolveLocation(undefined);
    resolveColocatedEntities([]);
    await act(async () => {
      await rendered!.waitForNextUpdate();
    });

    expect(rendered!.result.current).toEqual({
      type: 'only-delete',
      deleteEntity: expect.any(Function),
    });
  });

  it('chooses only-delete when the location could not be found', async () => {
    let rendered: RenderHookResult<
      { children?: ReactNode },
      UseUnregisterEntityDialogState
    >;
    act(() => {
      rendered = renderHook(() => useUnregisterEntityDialogState(entity), {
        wrapper: Wrapper,
      });
    });

    resolveLocation(undefined);
    resolveColocatedEntities([]);
    await act(async () => {
      await rendered!.waitForNextUpdate();
    });

    expect(rendered!.result.current).toEqual({
      type: 'only-delete',
      deleteEntity: expect.any(Function),
    });
  });
});
