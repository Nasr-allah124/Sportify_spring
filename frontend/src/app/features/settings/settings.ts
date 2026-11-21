import { Component } from '@angular/core';
import {ThemeToggle} from '../../shared/theme-toggle/theme-toggle';
import { OwnerApplication } from './owner-application';

@Component({
  selector: 'app-settings',
  standalone: true,
  imports: [
    ThemeToggle,
    OwnerApplication
  ],
  templateUrl: './settings.html'
})
export class Settings {}
