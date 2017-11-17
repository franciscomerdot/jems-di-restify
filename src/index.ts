import { Server, RequestHandlerType, RequestHandler, RouteOptions } from "restify";
import { createKernel, Kernel, ResolutionOption } from "@jems/di";
import * as methods from "methods";

/**
 * Configure the restify server by intercepting all the handlers registration and decorating those to be invoken by the kernel.
 * @param restifyServer Represents the restify server to be configured.
 * @param kernel Represents a kernel to be used in the resolutions, if not provided a new one will be created
 * @returns Return the kernel that will be used for the resolutions.
 */
export function configureRestifyServer(restifyServer: Server, kernel?:Kernel) : Kernel {

    if (!kernel) {
        kernel = createKernel();
    }

    ['pre', 'use'].forEach(handlerRegistrar => configureUnroutedHandlers(restifyServer, kernel, handlerRegistrar));    
    methods.forEach(handlerRegistrar => configureRoutedHandlers(restifyServer, kernel, handlerRegistrar));

    return kernel;
}

/**
 * Configure the handler registrars that do not need to be routed.
 * @param restifyServer Represents the restify server to be configured.
 * @param kernel Represents a kernel to be used in the resolutions, if not provided a new one will be created
 * @param unroutedHandlerRegistrarName Represents the server function name to register handlers without routers.
 */
function configureUnroutedHandlers(restifyServer: Server, kernel:Kernel, unroutedHandlerRegistrarName: string) {
    let originalUnroutedHandlerRegistrar: (...handlers:RequestHandlerType[]) => Server = restifyServer[unroutedHandlerRegistrarName];

    if (!originalUnroutedHandlerRegistrar) {
        return;
    }

    originalUnroutedHandlerRegistrar = originalUnroutedHandlerRegistrar.bind(restifyServer);

    restifyServer[unroutedHandlerRegistrarName] = 
                function (...handlers: RequestHandlerType[]) {
                    originalUnroutedHandlerRegistrar(getConfiguredHandlers(restifyServer, kernel, ...handlers))
                };
}

/**
 * Configure the handler registrars that needs to be routed.
 * @param restifyServer Represents the restify server to be configured.
 * @param kernel Represents a kernel to be used in the resolutions, if not provided a new one will be created
 * @param routedHandlerRegistrarName Represents the server function name to register handlers with routers.
 */
function configureRoutedHandlers(restifyServer: Server, kernel:Kernel, routedHandlerRegistrarName: string) {
    let originalRoutedHandlerRegistrar: (opts: string | RegExp | RouteOptions, ...handlers:RequestHandlerType[]) => Server = restifyServer[routedHandlerRegistrarName];
    
    if (!originalRoutedHandlerRegistrar) {
        return;
    }

    originalRoutedHandlerRegistrar = originalRoutedHandlerRegistrar.bind(restifyServer);

    restifyServer[routedHandlerRegistrarName] = 
                function (opts: string | RegExp | RouteOptions, ...handlers: RequestHandlerType[]) {
                    originalRoutedHandlerRegistrar(opts, getConfiguredHandlers(restifyServer, kernel, ...handlers))
                };
}

/**
 * Return a list configured handler based on the given ones that can resolve dependencies.
 * @param restifyServer Represents the restify server to be configured.
 * @param kernel Represents a kernel to be used in the resolutions, if not provided a new one will be created
 * @param handlers Represents the hlandlers that will be configured.
 */
function getConfiguredHandlers(restifyServer: Server, kernel:Kernel, ...handlers:RequestHandlerType[]): RequestHandler[] {

    let dihandlers: RequestHandler[] = handlers.map(handler => function(req, res, next) {

        let resolutionOption: ResolutionOption = new ResolutionOption();
        resolutionOption.dependencies = {
            req: req,
            res: res,
            next: next
        };

        kernel.resolve(<Function>handler, resolutionOption);
    });

    return dihandlers;
};
