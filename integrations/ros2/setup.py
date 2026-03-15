"""colcon/ament build setup for the OpenEye ROS2 bridge package."""

from setuptools import find_packages, setup

package_name = "openeye_ros2_bridge"

setup(
    name=package_name,
    version="0.1.0",
    packages=find_packages(),
    data_files=[
        ("share/ament_index/resource_index/packages", [f"resource/{package_name}"]),
        (f"share/{package_name}", ["package.xml"]),
        (
            f"share/{package_name}/launch",
            ["openeye_ros2_bridge/launch/perception.launch.py"],
        ),
    ],
    install_requires=["setuptools"],
    zip_safe=True,
    maintainer="OpenEye Team",
    maintainer_email="team@perceptify.dev",
    description="OpenEye perception bridge for ROS2",
    license="MIT",
    entry_points={
        "console_scripts": [
            "openeye_perception_node = openeye_ros2_bridge.perception_node:main",
        ],
    },
)
