/*
 * Copyright 2023 The Backstage Authors
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

import React, { ReactNode } from 'react';
import {
  Extension,
  createApiExtension,
  createPageExtension,
  createPlugin,
  BackstagePlugin,
} from '@backstage/frontend-plugin-api';
import { Route, Routes } from 'react-router-dom';
import {
  BackstagePlugin as LegacyBackstagePlugin,
  RouteRef,
  getComponentData,
} from '@backstage/core-plugin-api';
import { convertLegacyRouteRef } from '@backstage/core-plugin-api/alpha';

export function collectLegacyRoutes(
  flatRoutesElement: JSX.Element,
): BackstagePlugin[] {
  const results = new Array<BackstagePlugin>();

  React.Children.forEach(
    flatRoutesElement.props.children,
    (route: ReactNode) => {
      if (!React.isValidElement(route)) {
        return;
      }

      // TODO(freben): Handle feature flag and permissions framework wrapper elements
      if (route.type !== Route) {
        return;
      }

      const routeElement = route.props.element;

      // TODO: to support deeper extension component, e.g. hidden within <RequirePermission>, use https://github.com/backstage/backstage/blob/518a34646b79ec2028cc0ed6bc67d4366c51c4d6/packages/core-app-api/src/routing/collectors.tsx#L69
      const plugin = getComponentData<LegacyBackstagePlugin>(
        routeElement,
        'core.plugin',
      );
      if (!plugin) {
        return;
      }

      const routeRef = getComponentData<RouteRef>(
        routeElement,
        'core.mountPoint',
      );

      const pluginId = plugin.getId();
      const path: string = route.props.path;

      const detectedExtensions = new Array<Extension<unknown>>();

      detectedExtensions.push(
        createPageExtension({
          id: `plugin.${pluginId}.page`,
          defaultPath: path[0] === '/' ? path.slice(1) : path,
          routeRef: routeRef ? convertLegacyRouteRef(routeRef) : undefined,

          loader: async () =>
            route.props.children ? (
              <Routes>
                <Route path="*" element={routeElement}>
                  <Route path="*" element={route.props.children} />
                </Route>
              </Routes>
            ) : (
              routeElement
            ),
        }),
      );

      detectedExtensions.push(
        ...Array.from(plugin.getApis()).map(factory =>
          createApiExtension({
            factory,
          }),
        ),
      );

      results.push(
        createPlugin({
          id: plugin.getId(),
          extensions: detectedExtensions,
        }),
      );
    },
  );

  return results;
}
