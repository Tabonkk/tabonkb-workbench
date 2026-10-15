cmake_minimum_required(VERSION 3.20)
project(dslogic-core C)

# 官方源码只编译不修改：源文件清单照搬 DSView-master/CMakeLists.txt（v1.3.2）
# 的 libsigrok4DSL_SOURCES / libsigrokdecode4DSL_SOURCES / common_SOURCES，
# 仅去掉 tests 与 GUI 部分。

set(CMAKE_C_STANDARD 99)
set(CMAKE_C_STANDARD_REQUIRED ON)
if(NOT CMAKE_BUILD_TYPE)
    set(CMAKE_BUILD_TYPE Release)
endif()
add_compile_options(-O3 -Wall -Wextra -Wno-return-type -Wno-ignored-qualifiers
                    -Wno-unused-parameter -Wno-sign-compare -Wno-missing-field-initializers)

find_package(PkgConfig REQUIRED)
pkg_search_module(GLIB REQUIRED glib-2.0)
find_package(Python3 COMPONENTS Development REQUIRED)
find_package(ZLIB REQUIRED)
find_package(libusb-1.0 QUIET)
if(NOT LIBUSB_1_FOUND)
    pkg_search_module(LIBUSB_1 REQUIRED libusb-1.0)
endif()

set(TP ${CMAKE_CURRENT_SOURCE_DIR}/third_party)

set(libsigrok4DSL_SOURCES
    ${TP}/libsigrok4DSL/version.c
    ${TP}/libsigrok4DSL/strutil.c
    ${TP}/libsigrok4DSL/std.c
    ${TP}/libsigrok4DSL/session_driver.c
    ${TP}/libsigrok4DSL/session.c
    ${TP}/libsigrok4DSL/log.c
    ${TP}/libsigrok4DSL/hwdriver.c
    ${TP}/libsigrok4DSL/error.c
    ${TP}/libsigrok4DSL/backend.c
    ${TP}/libsigrok4DSL/output/output.c
    ${TP}/libsigrok4DSL/input/input.c
    ${TP}/libsigrok4DSL/hardware/demo/demo.c
    ${TP}/libsigrok4DSL/input/in_binary.c
    ${TP}/libsigrok4DSL/input/in_vcd.c
    ${TP}/libsigrok4DSL/input/in_wav.c
    ${TP}/libsigrok4DSL/output/csv.c
    ${TP}/libsigrok4DSL/output/gnuplot.c
    ${TP}/libsigrok4DSL/output/srzip.c
    ${TP}/libsigrok4DSL/output/vcd.c
    ${TP}/libsigrok4DSL/hardware/DSL/dslogic.c
    ${TP}/libsigrok4DSL/hardware/common/usb.c
    ${TP}/libsigrok4DSL/hardware/common/ezusb.c
    ${TP}/libsigrok4DSL/trigger.c
    ${TP}/libsigrok4DSL/dsdevice.c
    ${TP}/libsigrok4DSL/hardware/DSL/dscope.c
    ${TP}/libsigrok4DSL/hardware/DSL/command.c
    ${TP}/libsigrok4DSL/hardware/DSL/dsl.c
    ${TP}/libsigrok4DSL/lib_main.c
)

set(libsigrokdecode4DSL_SOURCES
    ${TP}/libsigrokdecode4DSL/type_decoder.c
    ${TP}/libsigrokdecode4DSL/srd.c
    ${TP}/libsigrokdecode4DSL/module_sigrokdecode.c
    ${TP}/libsigrokdecode4DSL/decoder.c
    ${TP}/libsigrokdecode4DSL/error.c
    ${TP}/libsigrokdecode4DSL/exception.c
    ${TP}/libsigrokdecode4DSL/instance.c
    ${TP}/libsigrokdecode4DSL/log.c
    ${TP}/libsigrokdecode4DSL/session.c
    ${TP}/libsigrokdecode4DSL/util.c
    ${TP}/libsigrokdecode4DSL/version.c
)

set(common_SOURCES
    ${TP}/common/minizip/zip.c
    ${TP}/common/minizip/unzip.c
    ${TP}/common/minizip/ioapi.c
    ${TP}/common/log/xlog.c
)

set(glue_SOURCES
    src/jsonlite.c
    src/ndjson.c
    src/capture.c
    src/edge_index.c
    src/decode.c
    src/main.c
)

add_executable(dslogic-core
    ${common_SOURCES}
    ${libsigrok4DSL_SOURCES}
    ${libsigrokdecode4DSL_SOURCES}
    ${glue_SOURCES}
)

target_include_directories(dslogic-core PRIVATE
    ${TP}/libsigrok4DSL
    ${TP}/libsigrokdecode4DSL
    ${TP}/common
    ${CMAKE_CURRENT_SOURCE_DIR}/src
    ${GLIB_INCLUDE_DIRS}
    ${LIBUSB_1_INCLUDE_DIRS}
    ${Python3_INCLUDE_DIRS}
    ${ZLIB_INCLUDE_DIRS}
)

target_link_directories(dslogic-core PRIVATE
    ${GLIB_LIBDIR}
    ${LIBUSB_1_LIBDIR}
)

target_link_libraries(dslogic-core PRIVATE
    glib-2.0
    usb-1.0
    z
    ${Python3_LIBRARIES}
)
