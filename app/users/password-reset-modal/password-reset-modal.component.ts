import { Component } from '@angular/core';
import { ModalDialogParams } from 'nativescript-angular/modal-dialog';

import { AlertService } from '../../services';
import { utilities } from '../../shared';

@Component({
    moduleId: module.id,
    selector: 'password-reset-modal',
    templateUrl: './password-reset-modal.template.html',
    styleUrls: [ './password-reset-modal.component.css' ]
})
export class PasswordResetModalComponent {
    title: string = 'Reset your password';
    text: string = 'Enter the email address that you signed up with.';
    email: string;
    buttons = { ok: 'Send reset instructions', cancel: 'Cancel' };

    constructor(
        private _params: ModalDialogParams,
        private _alertsService: AlertService
    ) {}

    onOk() {
        if (!utilities.isEmail(this.email)) {
            return this._alertsService.showError('Please enter a valid email address');
        }
        this._params.closeCallback(this.email);
    }

    onCancel() {
        this._params.closeCallback();
    }
}
