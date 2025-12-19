# CI/CD Setup Guide for Maestro Tests

Complete guide for integrating Maestro mobile tests into continuous integration pipelines.

## GitHub Actions

### iOS Testing

**`.github/workflows/ios-tests.yml`:**

```yaml
name: iOS Tests

on:
  pull_request:
    branches: [main, develop]
  push:
    branches: [main]
  workflow_dispatch:  # Manual trigger

jobs:
  ios-tests:
    runs-on: macos-13  # macOS required for iOS simulators
    timeout-minutes: 60

    strategy:
      matrix:
        # Test on multiple iOS versions
        ios-version: ['16.0', '17.0']
        include:
          - ios-version: '16.0'
            simulator: 'iPhone 14'
          - ios-version: '17.0'
            simulator: 'iPhone 15'
      fail-fast: false  # Continue other jobs if one fails

    steps:
      - name: Checkout Code
        uses: actions/checkout@v4

      - name: Setup Xcode
        uses: maxim-lobanov/setup-xcode@v1
        with:
          xcode-version: '15.0'

      - name: Install Maestro
        run: |
          curl -Ls "https://get.maestro.mobile.dev" | bash
          echo "$HOME/.maestro/bin" >> $GITHUB_PATH

      - name: Verify Maestro Installation
        run: maestro --version

      - name: Cache CocoaPods
        uses: actions/cache@v3
        with:
          path: ios/Pods
          key: pods-${{ runner.os }}-${{ hashFiles('ios/Podfile.lock') }}
          restore-keys: |
            pods-${{ runner.os }}-

      - name: Install Dependencies
        run: |
          cd ios
          pod install

      - name: Select Xcode
        run: sudo xcode-select -s /Applications/Xcode.app

      - name: List Available Simulators
        run: xcrun simctl list devices available

      - name: Boot Simulator
        run: |
          SIMULATOR_UDID=$(xcrun simctl list devices available | grep "${{ matrix.simulator }}" | grep "${{ matrix.ios-version }}" | head -1 | grep -o '[0-9A-F-]\{36\}')
          echo "SIMULATOR_UDID=$SIMULATOR_UDID" >> $GITHUB_ENV
          xcrun simctl boot "$SIMULATOR_UDID"
          xcrun simctl bootstatus "$SIMULATOR_UDID"

      - name: Build App
        run: |
          xcodebuild \
            -workspace ios/App.xcworkspace \
            -scheme App \
            -configuration Debug \
            -sdk iphonesimulator \
            -destination "id=${{ env.SIMULATOR_UDID }}" \
            -derivedDataPath ios/build \
            CODE_SIGN_IDENTITY="" \
            CODE_SIGNING_REQUIRED=NO

      - name: Install App on Simulator
        run: |
          APP_PATH=$(find ios/build/Build/Products/Debug-iphonesimulator -name "*.app" -type d | head -1)
          xcrun simctl install ${{ env.SIMULATOR_UDID }} "$APP_PATH"

      - name: Run Maestro Tests
        env:
          EMAIL: ${{ secrets.TEST_EMAIL }}
          PASSWORD: ${{ secrets.TEST_PASSWORD }}
          API_URL: ${{ secrets.STAGING_API_URL }}
        run: |
          maestro test \
            --format junit \
            --output test-results.xml \
            maestro-flows/

      - name: Upload Test Results
        if: always()
        uses: actions/upload-artifact@v3
        with:
          name: test-results-ios-${{ matrix.ios-version }}
          path: |
            test-results.xml
            ~/.maestro/tests/**/

      - name: Publish Test Report
        if: always()
        uses: mikepenz/action-junit-report@v4
        with:
          report_paths: test-results.xml
          check_name: iOS ${{ matrix.ios-version }} Test Results

      - name: Comment PR with Results
        if: github.event_name == 'pull_request' && failure()
        uses: actions/github-script@v6
        with:
          script: |
            github.rest.issues.createComment({
              issue_number: context.issue.number,
              owner: context.repo.owner,
              repo: context.repo.repo,
              body: '❌ iOS ${{ matrix.ios-version }} tests failed. Check the workflow logs for details.'
            })

      - name: Shutdown Simulator
        if: always()
        run: xcrun simctl shutdown ${{ env.SIMULATOR_UDID }} || true
```

### Android Testing

**`.github/workflows/android-tests.yml`:**

```yaml
name: Android Tests

on:
  pull_request:
    branches: [main, develop]
  push:
    branches: [main]
  workflow_dispatch:

jobs:
  android-tests:
    runs-on: macos-13  # macOS for better emulator performance
    timeout-minutes: 60

    strategy:
      matrix:
        api-level: [30, 33]
        target: [google_apis]
        arch: [x86_64]
      fail-fast: false

    steps:
      - name: Checkout Code
        uses: actions/checkout@v4

      - name: Setup JDK
        uses: actions/setup-java@v3
        with:
          distribution: 'zulu'
          java-version: '17'

      - name: Install Maestro
        run: |
          curl -Ls "https://get.maestro.mobile.dev" | bash
          echo "$HOME/.maestro/bin" >> $GITHUB_PATH

      - name: Verify Maestro Installation
        run: maestro --version

      - name: Cache Gradle
        uses: actions/cache@v3
        with:
          path: |
            ~/.gradle/caches
            ~/.gradle/wrapper
            android/.gradle
          key: gradle-${{ runner.os }}-${{ hashFiles('android/**/*.gradle*', 'android/**/gradle-wrapper.properties') }}
          restore-keys: |
            gradle-${{ runner.os }}-

      - name: Setup Android SDK
        uses: android-actions/setup-android@v2

      - name: AVD Cache
        uses: actions/cache@v3
        id: avd-cache
        with:
          path: |
            ~/.android/avd/*
            ~/.android/adb*
          key: avd-${{ matrix.api-level }}-${{ matrix.target }}-${{ matrix.arch }}

      - name: Create AVD and Generate Snapshot
        if: steps.avd-cache.outputs.cache-hit != 'true'
        uses: reactivecircus/android-emulator-runner@v2
        with:
          api-level: ${{ matrix.api-level }}
          target: ${{ matrix.target }}
          arch: ${{ matrix.arch }}
          force-avd-creation: false
          emulator-options: -no-window -gpu swiftshader_indirect -noaudio -no-boot-anim -camera-back none
          disable-animations: true
          script: echo "Generated AVD snapshot for caching."

      - name: Build APK
        run: |
          cd android
          ./gradlew assembleDebug --no-daemon

      - name: Run Maestro Tests on Emulator
        uses: reactivecircus/android-emulator-runner@v2
        env:
          EMAIL: ${{ secrets.TEST_EMAIL }}
          PASSWORD: ${{ secrets.TEST_PASSWORD }}
          API_URL: ${{ secrets.STAGING_API_URL }}
        with:
          api-level: ${{ matrix.api-level }}
          target: ${{ matrix.target }}
          arch: ${{ matrix.arch }}
          profile: pixel_6
          force-avd-creation: false
          emulator-options: -no-snapshot-save -no-window -gpu swiftshader_indirect -noaudio -no-boot-anim
          disable-animations: true
          script: |
            adb wait-for-device
            adb shell settings put global window_animation_scale 0
            adb shell settings put global transition_animation_scale 0
            adb shell settings put global animator_duration_scale 0

            maestro test \
              --format junit \
              --output test-results.xml \
              maestro-flows/

      - name: Upload Test Results
        if: always()
        uses: actions/upload-artifact@v3
        with:
          name: test-results-android-api-${{ matrix.api-level }}
          path: |
            test-results.xml
            ~/.maestro/tests/**/

      - name: Publish Test Report
        if: always()
        uses: mikepenz/action-junit-report@v4
        with:
          report_paths: test-results.xml
          check_name: Android API ${{ matrix.api-level }} Test Results

      - name: Comment PR with Results
        if: github.event_name == 'pull_request' && failure()
        uses: actions/github-script@v6
        with:
          script: |
            github.rest.issues.createComment({
              issue_number: context.issue.number,
              owner: context.repo.owner,
              repo: context.repo.repo,
              body: '❌ Android API ${{ matrix.api-level }} tests failed. Check the workflow logs for details.'
            })
```

### Combined iOS and Android

**`.github/workflows/mobile-tests.yml`:**

```yaml
name: Mobile Tests

on:
  pull_request:
    branches: [main]
  push:
    branches: [main]

jobs:
  # Reference iOS job
  ios:
    uses: ./.github/workflows/ios-tests.yml
    secrets: inherit

  # Reference Android job
  android:
    uses: ./.github/workflows/android-tests.yml
    secrets: inherit

  # Summary job
  test-summary:
    needs: [ios, android]
    runs-on: ubuntu-latest
    if: always()
    steps:
      - name: Check Test Results
        run: |
          if [[ "${{ needs.ios.result }}" == "failure" ]] || [[ "${{ needs.android.result }}" == "failure" ]]; then
            echo "Tests failed"
            exit 1
          fi
          echo "All tests passed!"
```

## Bitrise

**`bitrise.yml`:**

```yaml
format_version: '11'
default_step_lib_source: https://github.com/bitrise-io/bitrise-steplib.git

app:
  envs:
    - MAESTRO_VERSION: latest

workflows:
  ios-tests:
    steps:
      - activate-ssh-key@4: {}
      - git-clone@8: {}

      - cache-pull@2: {}

      - certificate-and-profile-installer@1: {}

      - cocoapods-install@2:
          inputs:
            - source_root_path: ios

      - xcode-build-for-simulator@0:
          inputs:
            - project_path: ios/App.xcworkspace
            - scheme: App
            - configuration: Debug
            - simulator_device: iPhone 14

      - script@1:
          title: Install Maestro
          inputs:
            - content: |
                #!/usr/bin/env bash
                set -ex
                curl -Ls "https://get.maestro.mobile.dev" | bash
                echo 'export PATH="$HOME/.maestro/bin:$PATH"' >> ~/.bash_profile
                source ~/.bash_profile
                maestro --version

      - script@1:
          title: Install App on Simulator
          inputs:
            - content: |
                #!/usr/bin/env bash
                set -ex
                xcrun simctl install booted "$BITRISE_APP_DIR_PATH"

      - script@1:
          title: Run Maestro Tests
          inputs:
            - content: |
                #!/usr/bin/env bash
                set -ex
                export PATH="$HOME/.maestro/bin:$PATH"

                maestro test \
                  --format junit \
                  --output $BITRISE_DEPLOY_DIR/test-results.xml \
                  maestro-flows/

      - deploy-to-bitrise-io@2:
          inputs:
            - deploy_path: $BITRISE_DEPLOY_DIR
            - is_compress: 'true'

      - cache-push@2:
          inputs:
            - cache_paths: |
                ios/Pods -> ios/Podfile.lock
                ~/.maestro

  android-tests:
    steps:
      - activate-ssh-key@4: {}
      - git-clone@8: {}

      - cache-pull@2: {}

      - install-missing-android-tools@3:
          inputs:
            - gradlew_path: android/gradlew

      - android-build@1:
          inputs:
            - project_location: android
            - module: app
            - variant: debug

      - avd-manager@1:
          inputs:
            - profile: pixel_6
            - api_level: 33
            - tag: google_apis

      - wait-for-android-emulator@1: {}

      - script@1:
          title: Install Maestro
          inputs:
            - content: |
                #!/usr/bin/env bash
                set -ex
                curl -Ls "https://get.maestro.mobile.dev" | bash
                echo 'export PATH="$HOME/.maestro/bin:$PATH"' >> ~/.bash_profile
                source ~/.bash_profile
                maestro --version

      - script@1:
          title: Disable Animations
          inputs:
            - content: |
                #!/usr/bin/env bash
                adb shell settings put global window_animation_scale 0
                adb shell settings put global transition_animation_scale 0
                adb shell settings put global animator_duration_scale 0

      - script@1:
          title: Run Maestro Tests
          inputs:
            - content: |
                #!/usr/bin/env bash
                set -ex
                export PATH="$HOME/.maestro/bin:$PATH"

                maestro test \
                  --format junit \
                  --output $BITRISE_DEPLOY_DIR/test-results.xml \
                  maestro-flows/

      - deploy-to-bitrise-io@2:
          inputs:
            - deploy_path: $BITRISE_DEPLOY_DIR
            - is_compress: 'true'

      - cache-push@2:
          inputs:
            - cache_paths: |
                $HOME/.gradle
                android/.gradle
                ~/.maestro
```

## CircleCI

**`.circleci/config.yml`:**

```yaml
version: 2.1

orbs:
  android: circleci/android@2.0
  macos: circleci/macos@2

jobs:
  ios-tests:
    macos:
      xcode: 15.0.0
    resource_class: macos.m1.medium.gen1

    steps:
      - checkout

      - restore_cache:
          keys:
            - pods-{{ checksum "ios/Podfile.lock" }}

      - run:
          name: Install Dependencies
          command: |
            cd ios
            pod install

      - save_cache:
          key: pods-{{ checksum "ios/Podfile.lock" }}
          paths:
            - ios/Pods

      - run:
          name: Install Maestro
          command: |
            curl -Ls "https://get.maestro.mobile.dev" | bash
            echo 'export PATH="$HOME/.maestro/bin:$PATH"' >> $BASH_ENV
            source $BASH_ENV

      - run:
          name: Boot Simulator
          command: |
            xcrun simctl boot "iPhone 14" || true
            xcrun simctl bootstatus "iPhone 14"

      - run:
          name: Build App
          command: |
            xcodebuild \
              -workspace ios/App.xcworkspace \
              -scheme App \
              -configuration Debug \
              -sdk iphonesimulator \
              -destination 'platform=iOS Simulator,name=iPhone 14' \
              -derivedDataPath ios/build

      - run:
          name: Install App
          command: |
            APP_PATH=$(find ios/build/Build/Products/Debug-iphonesimulator -name "*.app" | head -1)
            xcrun simctl install booted "$APP_PATH"

      - run:
          name: Run Tests
          command: |
            maestro test \
              --format junit \
              --output test-results.xml \
              maestro-flows/

      - store_test_results:
          path: test-results.xml

      - store_artifacts:
          path: ~/.maestro/tests
          destination: test-artifacts

  android-tests:
    machine:
      image: android:2023.07.1
    resource_class: large

    steps:
      - checkout

      - restore_cache:
          keys:
            - gradle-{{ checksum "android/build.gradle" }}

      - run:
          name: Build APK
          command: |
            cd android
            ./gradlew assembleDebug

      - save_cache:
          key: gradle-{{ checksum "android/build.gradle" }}
          paths:
            - ~/.gradle

      - run:
          name: Install Maestro
          command: |
            curl -Ls "https://get.maestro.mobile.dev" | bash
            echo 'export PATH="$HOME/.maestro/bin:$PATH"' >> $BASH_ENV

      - run:
          name: Create and Start Emulator
          command: |
            avdmanager create avd -n test -k "system-images;android-33;google_apis;x86_64" --device "pixel_6"
            emulator -avd test -no-window -no-audio -no-boot-anim &
            adb wait-for-device
            adb shell settings put global window_animation_scale 0
            adb shell settings put global transition_animation_scale 0
            adb shell settings put global animator_duration_scale 0

      - run:
          name: Run Tests
          command: |
            maestro test \
              --format junit \
              --output test-results.xml \
              maestro-flows/

      - store_test_results:
          path: test-results.xml

      - store_artifacts:
          path: ~/.maestro/tests
          destination: test-artifacts

workflows:
  version: 2
  test:
    jobs:
      - ios-tests
      - android-tests
```

## GitLab CI

**`.gitlab-ci.yml`:**

```yaml
stages:
  - test

variables:
  MAESTRO_VERSION: latest

ios-tests:
  stage: test
  tags:
    - macos
  script:
    - curl -Ls "https://get.maestro.mobile.dev" | bash
    - export PATH="$HOME/.maestro/bin:$PATH"

    - cd ios
    - pod install
    - cd ..

    - xcrun simctl boot "iPhone 14" || true
    - xcrun simctl bootstatus "iPhone 14"

    - xcodebuild
        -workspace ios/App.xcworkspace
        -scheme App
        -configuration Debug
        -sdk iphonesimulator
        -destination 'platform=iOS Simulator,name=iPhone 14'
        -derivedDataPath ios/build

    - APP_PATH=$(find ios/build/Build/Products/Debug-iphonesimulator -name "*.app" | head -1)
    - xcrun simctl install booted "$APP_PATH"

    - maestro test
        --format junit
        --output test-results.xml
        maestro-flows/

  artifacts:
    when: always
    reports:
      junit: test-results.xml
    paths:
      - ~/.maestro/tests/

android-tests:
  stage: test
  image: reactnativecommunity/react-native-android:latest
  script:
    - curl -Ls "https://get.maestro.mobile.dev" | bash
    - export PATH="$HOME/.maestro/bin:$PATH"

    - cd android
    - ./gradlew assembleDebug
    - cd ..

    - avdmanager create avd -n test -k "system-images;android-33;google_apis;x86_64"
    - emulator -avd test -no-window -no-audio &
    - adb wait-for-device

    - adb shell settings put global window_animation_scale 0
    - adb shell settings put global transition_animation_scale 0
    - adb shell settings put global animator_duration_scale 0

    - maestro test
        --format junit
        --output test-results.xml
        maestro-flows/

  artifacts:
    when: always
    reports:
      junit: test-results.xml
    paths:
      - ~/.maestro/tests/
```

## Best Practices

### Secrets Management

Store sensitive data in CI secrets:

```yaml
env:
  EMAIL: ${{ secrets.TEST_EMAIL }}
  PASSWORD: ${{ secrets.TEST_PASSWORD }}
  API_URL: ${{ secrets.STAGING_API_URL }}
  API_KEY: ${{ secrets.API_KEY }}
```

Never commit credentials to repository.

### Caching

Cache dependencies for faster builds:

**Pods (iOS):**
```yaml
- uses: actions/cache@v3
  with:
    path: ios/Pods
    key: pods-${{ hashFiles('ios/Podfile.lock') }}
```

**Gradle (Android):**
```yaml
- uses: actions/cache@v3
  with:
    path: |
      ~/.gradle/caches
      ~/.gradle/wrapper
    key: gradle-${{ hashFiles('android/**/*.gradle*') }}
```

### Parallel Execution

Run tests in parallel by suite:

```yaml
strategy:
  matrix:
    suite: [auth, checkout, settings, profile]

steps:
  - run: maestro test maestro-flows/${{ matrix.suite }}/
```

### Retry on Failure

Retry flaky tests:

```yaml
- name: Run Tests
  uses: nick-invision/retry@v2
  with:
    timeout_minutes: 30
    max_attempts: 3
    command: maestro test maestro-flows/
```

### Resource Cleanup

Always cleanup resources:

```yaml
- name: Shutdown Simulator
  if: always()
  run: xcrun simctl shutdown all || true

- name: Kill Emulators
  if: always()
  run: adb emu kill || true
```

### Test Artifacts

Upload screenshots, videos, logs:

```yaml
- uses: actions/upload-artifact@v3
  if: always()
  with:
    name: test-artifacts
    path: |
      ~/.maestro/tests/**/
      test-results.xml
```

## Optimization Tips

1. **Use macOS runners** for iOS (required) and Android (faster)
2. **Cache AVD snapshots** (Android) for faster emulator boot
3. **Disable animations** on Android emulators
4. **Matrix testing** for multiple OS versions
5. **Fail-fast: false** to see all platform results
6. **Separate build and test** jobs for faster feedback
7. **Run critical tests first** in parallel
8. **Use local test environment** (mock APIs, seed data)
9. **Limit timeout** to avoid hanging jobs
10. **Clean state** between test runs

## Troubleshooting CI

### Slow Builds

- Cache dependencies
- Use faster runners (M1 macOS)
- Parallelize tests
- Build app once, test multiple times

### Flaky Tests in CI

- Disable animations (Android)
- Increase timeouts
- Use stable selectors
- Wait for app ready state

### Out of Resources

- Limit concurrent jobs
- Clean up old artifacts
- Use smaller emulator profiles
- Reduce matrix combinations

### Permission Denied

- Grant simulator/emulator permissions
- Check file system permissions
- Verify artifact upload paths exist
