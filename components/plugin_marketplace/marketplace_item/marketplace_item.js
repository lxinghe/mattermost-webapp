// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import PropTypes from 'prop-types';
import classNames from 'classnames';
import {Tooltip, OverlayTrigger} from 'react-bootstrap';
import semver from 'semver';

import {FormattedMessage, FormattedHTMLMessage} from 'react-intl';

import {Link} from 'react-router-dom';

import ConfirmModal from 'components/confirm_modal.jsx';
import LoadingWrapper from 'components/widgets/loading/loading_wrapper.tsx';
import PluginIcon from 'components/widgets/icons/plugin_icon.jsx';

import {trackEvent} from 'actions/diagnostics_actions.jsx';
import {localizeMessage} from 'utils/utils';
import {Constants} from 'utils/constants';

// UpdateVersion renders the version text in the update details, linking out to release notes if available.
export const UpdateVersion = ({version, releaseNotesUrl}) => {
    if (!releaseNotesUrl) {
        return version;
    }

    return (
        <a
            target='_blank'
            rel='noopener noreferrer'
            href={releaseNotesUrl}
        >
            {version}
        </a>
    );
};

UpdateVersion.propTypes = {
    version: PropTypes.string.isRequired,
    releaseNotesUrl: PropTypes.string,
};

// UpdateDetails renders an inline update prompt for plugins, when available.
export const UpdateDetails = ({version, releaseNotesUrl, installedVersion, isInstalling, onUpdate}) => {
    if (!installedVersion || isInstalling) {
        return null;
    }

    var isUpdate = false;
    try {
        isUpdate = semver.gt(version, installedVersion);
    } catch (e) {
        // If we fail to parse the version, assume not an update;
    }

    if (!isUpdate) {
        return null;
    }

    return (
        <div className={classNames('update')}>
            <FormattedMessage
                id='marketplace_modal.list.update_available'
                defaultMessage='Update available:'
            />
            {' '}
            <UpdateVersion
                version={version}
                releaseNotesUrl={releaseNotesUrl}
            />
            {' - '}
            <b>
                <a onClick={onUpdate}>
                    <FormattedMessage
                        id='marketplace_modal.list.update'
                        defaultMessage='Update'
                    />
                </a>
            </b>
        </div>
    );
};

UpdateDetails.propTypes = {
    version: PropTypes.string.isRequired,
    releaseNotesUrl: PropTypes.string,
    installedVersion: PropTypes.string,
    isInstalling: PropTypes.bool.isRequired,
    onUpdate: PropTypes.func.isRequired,
};

// UpdateConfirmationModal prompts before allowing upgrade, specially handling major version changes.
export const UpdateConfirmationModal = ({show, name, version, installedVersion, releaseNotesUrl, onUpdate, onCancel}) => {
    if (!installedVersion) {
        return null;
    }

    var isUpdate = false;
    try {
        isUpdate = semver.gt(version, installedVersion);
    } catch (e) {
        // If we fail to parse the version, assume not an update;
    }

    if (!isUpdate) {
        return null;
    }

    const messages = [(
        <p key='intro'>
            <FormattedMessage
                id='marketplace_modal.list.update_confirmation.message.intro'
                defaultMessage={`Are you sure you want to update the ${name} plugin to ${version}?`}
                values={{name, version}}
            />
        </p>
    )];

    if (releaseNotesUrl) {
        messages.push(
            <p key='current'>
                <FormattedHTMLMessage
                    id='marketplace_modal.list.update_confirmation.message.current_with_release_notes'
                    defaultMessage={`You currently have ${installedVersion} installed. View the <a href='${releaseNotesUrl}' target='_blank' rel='noopener noreferrer'>Release Notes</a> to learn about the changes included in this update.`}
                    values={{installedVersion, releaseNotesUrl}}
                />
            </p>
        );
    } else {
        messages.push(
            <p key='current'>
                <FormattedMessage
                    id='marketplace_modal.list.update_confirmation.message.current'
                    defaultMessage={`You currently have ${installedVersion} installed.`}
                    values={{installedVersion}}
                />
            </p>
        );
    }

    let sameMajorVersion = false;
    try {
        sameMajorVersion = semver.major(version) === semver.major(installedVersion);
    } catch (e) {
        // If we fail to parse the version, assume a potentially breaking change.
        // In practice, this won't happen since we already tried to parse the version above.
    }

    if (!sameMajorVersion) {
        if (releaseNotesUrl) {
            messages.push(
                <p
                    className='alert alert-warning'
                    key='warning'
                >
                    <FormattedMessage
                        id='marketplace_modal.list.update_confirmation.message.warning_major_version_with_release_notes'
                        defaultMessage={`This update may contain breaking changes. Consult the <a href='${releaseNotesUrl}' target='_blank' rel='noopener noreferrer'>release notes</a> before upgrading.`}
                    />
                </p>
            );
        } else {
            messages.push(
                <p
                    className='alert alert-warning'
                    key='warning'
                >
                    <FormattedMessage
                        id='marketplace_modal.list.update_confirmation.message.warning_major_version'
                        defaultMessage={'This update may contain breaking changes.'}
                    />
                </p>
            );
        }
    }

    return (
        <ConfirmModal
            show={show}
            title={
                <FormattedMessage
                    id='marketplace_modal.list.update_confirmation.title'
                    defaultMessage={'Confirm Plugin Update'}
                />
            }
            message={messages}
            confirmButtonText={
                <FormattedMessage
                    id='marketplace_modal.list.update_confirmation.confirm_button'
                    defaultMessage='Update'
                />
            }
            onConfirm={onUpdate}
            onCancel={onCancel}
        />
    );
};

UpdateConfirmationModal.propTypes = {
    show: PropTypes.bool.isRequired,
    name: PropTypes.string.isRequired,
    version: PropTypes.string.isRequired,
    releaseNotesUrl: PropTypes.string,
    installedVersion: PropTypes.string,
    onUpdate: PropTypes.func.isRequired,
    onCancel: PropTypes.func.isRequired,
};

export default class MarketplaceItem extends React.Component {
    static propTypes = {
        id: PropTypes.string.isRequired,
        name: PropTypes.string.isRequired,
        description: PropTypes.string.isRequired,
        version: PropTypes.string.isRequired,
        downloadUrl: PropTypes.string,
        homepageUrl: PropTypes.string,
        releaseNotesUrl: PropTypes.string,
        iconData: PropTypes.string,
        installedVersion: PropTypes.string.isRequired,
        installing: PropTypes.bool.isRequired,
        error: PropTypes.string,
        actions: PropTypes.shape({
            installPlugin: PropTypes.func.isRequired,
            closeMarketplaceModal: PropTypes.func.isRequired,
        }).isRequired,
    };

    constructor() {
        super();

        this.state = {
            showUpdateConfirmationModal: false,
        };
    }

    onInstall = () => {
        trackEvent('plugins', 'ui_marketplace_download');
        this.props.actions.installPlugin(this.props.id);
    }

    showUpdateConfirmationModal = () => {
        this.setState({showUpdateConfirmationModal: true});
    }

    hideUpdateConfirmationModal = () => {
        this.setState({showUpdateConfirmationModal: false});
    }

    onUpdate = () => {
        trackEvent('plugins', 'ui_marketplace_download_update');
        this.hideUpdateConfirmationModal();
        this.props.actions.installPlugin(this.props.id);
    }

    onConfigure = () => {
        trackEvent('plugins', 'ui_marketplace_configure');
        this.props.actions.closeMarketplaceModal();
    }

    getItemButton() {
        let actionButton = (
            <FormattedMessage
                id='marketplace_modal.list.Install'
                defaultMessage='Install'
            />
        );
        if (this.props.error) {
            actionButton = (
                <FormattedMessage
                    id='marketplace_modal.list.try_again'
                    defaultMessage='Try Again'
                />
            );
        }

        let button = (
            <button
                onClick={this.onInstall}
                className='btn btn-primary'
                disabled={this.props.installing || this.props.downloadUrl === ''}
            >
                <LoadingWrapper
                    loading={this.props.installing}
                    text={localizeMessage('marketplace_modal.installing', 'Installing...')}
                >
                    {actionButton}
                </LoadingWrapper>

            </button>
        );

        if (this.props.installedVersion !== '' && !this.props.installing && !this.props.error) {
            button = (
                <Link
                    to={'/admin_console/plugins/plugin_' + this.props.id}
                >
                    <button
                        onClick={this.onConfigure}
                        className='btn btn-outline'
                    >
                        <FormattedMessage
                            id='marketplace_modal.list.configure'
                            defaultMessage='Configure'
                        />
                    </button>
                </Link>
            );
        }

        return button;
    }

    render() {
        const ariaLabel = `${this.props.name}, ${this.props.description}`.toLowerCase();
        let versionLabel = `(${this.props.version})`;
        if (this.props.installedVersion !== '') {
            versionLabel = `(${this.props.installedVersion})`;
        }

        let pluginIcon;
        if (this.props.iconData) {
            pluginIcon = (
                <div className='icon__plugin icon__plugin--background'>
                    <img src={this.props.iconData}/>
                </div>
            );
        } else {
            pluginIcon = <PluginIcon className='icon__plugin icon__plugin--background'/>;
        }

        let localTag;
        if (!this.props.downloadUrl) {
            const localTooltip = (
                <Tooltip id='plugin-marketplace__local-tooltop'>
                    <FormattedMessage
                        id='marketplace_modal.list.local.tooltip'
                        defaultMessage='This plugin is not listed in the marketplace but was installed manually.'
                    />
                </Tooltip>
            );

            localTag = (
                <OverlayTrigger
                    delayShow={Constants.OVERLAY_TIME_DELAY}
                    placement='top'
                    overlay={localTooltip}
                >
                    <span className='tag'>
                        <FormattedMessage
                            id='marketplace_modal.list.local'
                            defaultMessage='LOCAL'
                        />
                    </span>
                </OverlayTrigger>
            );
        }

        const pluginDetailsInner = (
            <>
                {this.props.name} <span className='light subtitle'>{versionLabel}</span>
                {localTag}
                <p className={classNames('more-modal__description', {error_text: this.props.error})}>
                    {this.props.error ? this.props.error : this.props.description}
                </p>
            </>
        );

        let pluginDetails;
        if (this.props.homepageUrl) {
            pluginDetails = (
                <a
                    aria-label={ariaLabel}
                    className='style--none more-modal__row--link'
                    target='_blank'
                    rel='noopener noreferrer'
                    href={this.props.homepageUrl}
                >
                    {pluginDetailsInner}
                </a>
            );
        } else {
            pluginDetails = (
                <span
                    aria-label={ariaLabel}
                    className='style--none'
                >
                    {pluginDetailsInner}
                </span>
            );
        }

        return (
            <>
                <div
                    className={classNames('more-modal__row', 'more-modal__row--link', {item_error: this.props.error})}
                    key={this.props.id}
                    id={'marketplace-plugin-' + this.props.id}
                >
                    {pluginIcon}
                    <div className='more-modal__details'>
                        {pluginDetails}
                        <UpdateDetails
                            version={this.props.version}
                            installedVersion={this.props.installedVersion}
                            releaseNotesUrl={this.props.releaseNotesUrl}
                            isInstalling={this.props.installing}
                            onUpdate={this.showUpdateConfirmationModal}
                        />
                    </div>
                    <div className='more-modal__actions'>
                        {this.getItemButton()}
                    </div>
                    <UpdateConfirmationModal
                        show={this.state.showUpdateConfirmationModal}
                        name={this.props.name}
                        version={this.props.version}
                        installedVersion={this.props.installedVersion}
                        releaseNotesUrl={this.props.releaseNotesUrl}
                        onUpdate={this.onUpdate}
                        onCancel={this.hideUpdateConfirmationModal}
                    />
                </div>
            </>
        );
    }
}
