import {
    ApplicationConfig,
    APP_INITIALIZER
} from '@angular/core';

import {
    provideHttpClient
} from '@angular/common/http';

import {
    provideRouter
} from '@angular/router';

import { routes } from './app.routes';
import { ConfigService } from './services/config.service';


export function initializeApp(config: ConfigService) {

    return () => config.loadConfig();

}


export const appConfig: ApplicationConfig = {

    providers: [

        // Router
        provideRouter(routes),

        // HttpClient
        provideHttpClient(),

        // Load config.json before application starts
        {
            provide: APP_INITIALIZER,
            useFactory: initializeApp,
            deps: [ConfigService],
            multi: true
        }

    ]

};